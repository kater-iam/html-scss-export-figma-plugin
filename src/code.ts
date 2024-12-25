import { getTopLevelFrames } from './services/frames';
import { generateElementData } from './services/html-generator';
import { generateHTML } from './services/html-generator';
import { generateSCSS } from './services/scss-generator';

// プラグインウィンドウのサイズを設定
figma.showUI(__html__, {
    width: 320,
    height: 590,
    themeColors: true
});

function sendFramesToUI() {
    const frames = getTopLevelFrames();
    figma.ui.postMessage({
        type: 'frames-list',
        frames: frames.map(frame => ({
            name: frame.name,
            id: frame.id,
            children: frame.children.length
        }))
    });
}

figma.ui.onmessage = async (msg: { type: string, frameId?: string, message?: string }) => {
    switch (msg.type) {
        case 'get-frames':
            sendFramesToUI();
            break;
        case 'show-notification':
            if (msg.message) {
                figma.notify(msg.message);
            }
            break;
        case 'rename':
            if (msg.frameId) {
                try {
                    const node = await figma.getNodeByIdAsync(msg.frameId);
                    if (!node || node.type !== 'FRAME') {
                        throw new Error('Invalid frame ID');
                    }

                    // 再帰的にレイヤー名を変更する関数
                    async function renameLayer(node: SceneNode, isTopLevel = false) {
                        // HTMLタグ形式かクラス名付きかどうかをチェックする関数
                        function shouldSkipRename(name: string): boolean {
                            // 以下のパターンをスキップ:
                            // - タグ名の後に.が続くもの（例: div.class-name）
                            // - タグ名の後に[が続くもの（例: img[src="..."]）
                            return /^(div|p|img)[\.\[]/.test(name);
                        }

                        // トップレベルのフレーム以外のノードの名前を変更
                        if (!isTopLevel && !shouldSkipRename(node.name)) {
                            // テキストノードの場合は p に
                            if (node.type === 'TEXT') {
                                node.name = 'p';
                            }
                            // フレームの場合は div に
                            else if (node.type === 'FRAME') {
                                node.name = 'div';
                            }
                            // 画像の場合は img に
                            else if (node.type === 'RECTANGLE' && 'fills' in node && Array.isArray(node.fills) && node.fills.length > 0) {
                                const fill = node.fills[0];
                                if (fill.type === 'IMAGE') {
                                    // 画像のサイズを取得して、デフォルトのsrc属性を設定
                                    const width = Math.round(node.width);
                                    const height = Math.round(node.height);
                                    node.name = `img[src="https://placehold.jp/${width}x${height}.png"]`;
                                } else {
                                    node.name = 'div';
                                }
                            }
                            // その他のノードは div に
                            else {
                                node.name = 'div';
                            }
                        }

                        // 子要素があれば再帰的に処理（子要素は常にトップレベルではない）
                        if ('children' in node) {
                            for (const child of node.children) {
                                await renameLayer(child, false);
                            }
                        }
                    }

                    // トップレベルのフレームとして処理を開始
                    await renameLayer(node, true);
                    figma.notify('レイヤー名を変更しました');

                } catch (error) {
                    console.error('Error in rename:', error);
                    figma.notify('レイヤー名の変更に失敗しました', { error: true });
                }
            }
            break;
        case 'sp-layout':
            if (msg.frameId) {
                try {
                    const node = await figma.getNodeByIdAsync(msg.frameId);
                    if (!node || node.type !== 'FRAME') {
                        throw new Error('Invalid frame ID');
                    }
                    
                    // SPレイアウト用の設定
                    node.resize(425, node.height);

                    // 再帰的に.is_pcと.is_spの表示/非表示を切り替える
                    function toggleVisibility(node: SceneNode) {
                        // クラス名をチェック
                        const isPcElement = node.name.includes('.is_pc');
                        const isSpElement = node.name.includes('.is_sp');

                        // SPモードでの表示/非表示を設定
                        if (isPcElement) {
                            node.visible = false;
                        } else if (isSpElement) {
                            node.visible = true;
                        }

                        // 子要素があれば再帰的に処理
                        if ('children' in node) {
                            node.children.forEach(child => toggleVisibility(child));
                        }
                    }

                    toggleVisibility(node);
                    figma.notify('SPレイアウトを適用しました');

                } catch (error) {
                    console.error('Error in SP layout:', error);
                    figma.notify('SPレイアウトの適用に失敗しました', { error: true });
                }
            }
            break;
        case 'pc-layout':
            if (msg.frameId) {
                try {
                    const node = await figma.getNodeByIdAsync(msg.frameId);
                    if (!node || node.type !== 'FRAME') {
                        throw new Error('Invalid frame ID');
                    }
                    
                    // PCレイアウト用の設定
                    node.resize(1440, node.height);

                    // 再帰的に.is_pcと.is_spの表示/非表示を切り替える
                    function toggleVisibility(node: SceneNode) {
                        // クラス名をチェック
                        const isPcElement = node.name.includes('.is_pc');
                        const isSpElement = node.name.includes('.is_sp');

                        // PCモードでの表示/非表示を設定
                        if (isPcElement) {
                            node.visible = true;
                        } else if (isSpElement) {
                            node.visible = false;
                        }

                        // 子要素があれば再帰的に処理
                        if ('children' in node) {
                            node.children.forEach(child => toggleVisibility(child));
                        }
                    }

                    toggleVisibility(node);
                    figma.notify('PCレイアウトを適用しました');

                } catch (error) {
                    console.error('Error in PC layout:', error);
                    figma.notify('PCレイアウトの適用に失敗しました', { error: true });
                }
            }
            break;
        case 'export':            
            if (msg.frameId) {
                try {
                    const node = await figma.getNodeByIdAsync(msg.frameId);
                    if (!node || node.type !== 'FRAME') {
                        throw new Error('Invalid frame ID');
                    }
                    
                    let html = '';
                    let scss = '';

                    if ('children' in node && Array.isArray(node.children)) {
                        // 各子要素のElementDataを生成
                        const childrenElements = node.children.map(child => generateElementData(child));

                        // HTMLとSCSSを別々に生成
                        html = childrenElements
                            .map(child => generateHTML(child))
                            .join('\n');

                        scss = childrenElements
                            .map(child => generateSCSS(child))
                            .join('\n\n');
                    }

                    figma.ui.postMessage({
                        type: 'export-output',
                        html,
                        scss
                    });
                } catch (error) {
                    console.error('Error in export:', error);
                    figma.ui.postMessage({
                        type: 'export-output',
                        html: '<!-- Error generating HTML -->',
                        scss: '// Error generating SCSS'
                    });
                }
            }
            break;
        default:
            console.error('Unknown message type:', msg.type);
    }
};

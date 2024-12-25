import { ElementData, ParsedNodeName } from './types';

export const isTextNode = (node: SceneNode): node is TextNode => {
    return node.type === 'TEXT';
};

/**
 * レイヤー名からHTML要素の情報を解析する
 * 例: "div.class1#myId.class2[attr1="value1"]" → { tag: "div", classes: ["class1", "class2"], attributes: { id: "myId", attr1: "value1" } }
 * @param name レイヤー名
 * @returns 解析されたHTML要素の情報
 */
function parseNodeName(name: string): ParsedNodeName {
    const result: ParsedNodeName = {
        tag: 'div', // デフォルト値
        classes: [],
        attributes: {}
    };

    // 属性の抽出（複数の[]に対応）
    let cleanName = name;
    const attributeMatches = name.match(/\[(.*?)\]/g);
    if (attributeMatches) {
        attributeMatches.forEach(match => {
            const attributesStr = match.slice(1, -1); // []を除去
            const attributes = attributesStr.match(/([^=]+)="([^"]+)"/g);
            if (attributes) {
                attributes.forEach(attr => {
                    const [key, value] = attr.split('=');
                    // 属性名はそのまま使用（正規化しない）
                    result.attributes[key] = value.replace(/"/g, '');
                });
            }
            // 属性部分を除去してクラス名の解析に備える
            cleanName = cleanName.replace(match, '');
        });
    }

    // タグ名、ID、クラス名抽出（例: "div#myId.class1.class2"）
    const parts = cleanName.split(/[.#]/);
    if (parts.length > 0) {
        // 最初の部分がタグ名（空の場合はdivのまま）
        if (parts[0]) {
            result.tag = parts[0];
        }

        // ID とクラス名を抽出
        if (parts.length > 1) {
            const idAndClasses = cleanName.slice(parts[0].length).split('.');
            idAndClasses.forEach(part => {
                if (part.startsWith('#')) {
                    // IDの設定
                    result.attributes['id'] = part.slice(1);
                } else if (part) {
                    // クラス名の追加
                    result.classes.push(part);
                }
            });
        }
    }

    return result;
}

/**
 * Figmaのノードタイプに基づいてHTML要素の情報を取得する
 * @param node Figmaのノード
 * @returns HTML要素の情報
 */
function getNodeInfo(node: SceneNode): ParsedNodeName {
    const attributes: Record<string, string> = {};
        
    // デフォルトのタグ名を設定
    let defaultTag = 'div';

    // 名前からタグ名、クラス名、属性を抽出
    const parsed = parseNodeName(node.name);

    return {
        tag: parsed.tag || defaultTag,
        classes: parsed.classes,
        attributes: Object.assign({}, attributes, parsed.attributes)
    };
}

/**
 * FigmaのノードからHTML要素のデータ構造を生成する
 * @param node Figmaのノード
 * @returns HTML要素のデータ構造
 */
export function generateElementData(node: SceneNode): ElementData {    
    const nodeInfo = getNodeInfo(node);
    const children: ElementData[] = [];

    // 子要素の処理
    if ('children' in node && Array.isArray(node.children)) {
        for (const child of node.children) {
            children.push(generateElementData(child));
        }
    }

    // テキストノードの場合はテキストコンテンツを追加
    let text: string | undefined;
    if (isTextNode(node)) {
        text = node.characters;
    }

    // img要素の場合は特別な処理
    if (nodeInfo.tag === 'img') {
        const imgAttributes: Record<string, string> = {
            src: nodeInfo.attributes && nodeInfo.attributes['src'] ? nodeInfo.attributes['src'] : './images/dummy.jpg',
            width: Math.round(node.width).toString(),
            height: Math.round(node.height).toString()
        };

        // alt属性が存在する場合のみ追加
        if (nodeInfo.attributes && nodeInfo.attributes['alt']) {
            imgAttributes['alt'] = nodeInfo.attributes['alt'];
        }

        return {
            tag: 'img',
            classes: nodeInfo.classes,
            attributes: imgAttributes,
            children: [],
            _node: node
        };
    }

    return {
        tag: nodeInfo.tag,
        classes: nodeInfo.classes,
        attributes: nodeInfo.attributes,
        children,
        text,
        _node: node
    };
}

/**
 * HTML要素のデータ構造から実際のHTML文字列を生成する
 * @param elementData HTML要素のデータ構造
 * @param indent インデントレベル（スペース）
 * @returns 整形されたHTML文字列
 */
export function generateHTML(elementData: ElementData, indent = ''): string {
    const { tag, classes, attributes, children, text } = elementData;

    // クラスとアトリビュートの文字列生成
    const classStr = classes && classes.length > 0
        ? ` class="${classes.join(' ')}"`
        : '';

    const attrStr = attributes && Object.keys(attributes).length > 0
        ? ' ' + Object.entries(attributes)
            .map(([key, value]) => `${key}="${value}"`)
            .join(' ')
        : '';

    const openTag = `<${tag}${classStr}${attrStr}>`;

    // input要素とimg要素は自己終了タグとして扱う
    if (tag === 'input' || tag === 'img') {
        return `${indent}<${tag}${classStr}${attrStr}>`;
    }

    // テキストコンテンツを持つ要素の処理
    if (text) {
        return `${indent}${openTag}${text}</${tag}>`;
    }

    // 子要素を持たない要素の処理
    if (!children || children.length === 0) {
        return `${indent}${openTag}</${tag}>`;
    }

    // 子要素を持つ要素の処理
    const childrenHTML = children
        .map(child => generateHTML(child, indent + '  '))
        .join('\n');

    return `${indent}${openTag}\n${childrenHTML}\n${indent}</${tag}>`;
} 
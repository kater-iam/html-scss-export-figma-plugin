import { ElementData } from './types';
import { isTextNode } from './html-generator';

/**
 * Figmaのノードが自動レイアウト（Auto Layout）を持っているかを判定するタイプガード
 * @param node - 判定対象のFigmaノード
 * @returns 自動レイアウトを持つノードの場合true、そうでない場合false
 */
function isAutoLayoutNode(node: SceneNode): node is SceneNode & AutoLayoutMixin & LayoutMixin {
    if (!('layoutMode' in node)) return false;
    if (!('primaryAxisSizingMode' in node)) return false;
    if (!('counterAxisSizingMode' in node)) return false;
    if (!('primaryAxisAlignItems' in node)) return false;
    if (!('counterAxisAlignItems' in node)) return false;
    if (!('layoutAlign' in node)) return false;
    if (!('itemSpacing' in node)) return false;
    if (!('paddingTop' in node)) return false;
    if (!('paddingRight' in node)) return false;
    if (!('paddingBottom' in node)) return false;
    if (!('paddingLeft' in node)) return false;
    return true;
}

/**
 * レイアウトモードに基づいてwidth設定を決定する戦略パターン
 * - HORIZONTAL: 水平方向のレイアウトの場合の幅設定
 * - VERTICAL: 垂直方向のレイアウトの場合の幅設定
 */
const widthStrategies: Record<'HORIZONTAL' | 'VERTICAL', (node: SceneNode & AutoLayoutMixin & LayoutMixin) => string> = {
    HORIZONTAL: (node) => {
        if (node.primaryAxisSizingMode === 'AUTO') return 'width: fit-content';
        if ('layoutSizingHorizontal' in node && (node as any).layoutSizingHorizontal === 'FILL') return 'width: 100%';
        if (node.layoutAlign === 'STRETCH') return 'width: 100%';
        return `width: ${Math.round(node.width)}px`;
    },
    VERTICAL: (node) => {
        if (node.counterAxisSizingMode === 'AUTO') return 'width: fit-content';
        if ('layoutSizingHorizontal' in node && (node as any).layoutSizingHorizontal === 'FILL') return 'width: 100%';
        if (node.layoutAlign === 'STRETCH') return 'width: 100%';
        return `width: ${Math.round(node.width)}px`;
    }
};

// 主軸のアライメントマッピング
const primaryAxisAlignMap: Record<AutoLayoutMixin['primaryAxisAlignItems'], string> = {
    MIN: 'justify-content: flex-start',
    CENTER: 'justify-content: center',
    MAX: 'justify-content: flex-end',
    SPACE_BETWEEN: 'justify-content: space-between'
};

// 交差軸のアライメントマッピング
const counterAxisAlignMap: Record<AutoLayoutMixin['counterAxisAlignItems'], string> = {
    MIN: 'align-items: flex-start',
    CENTER: 'align-items: center',
    MAX: 'align-items: flex-end',
    BASELINE: 'align-items: baseline'
};

// レイアウトアラインのマッピング
const layoutAlignMap: Record<AutoLayoutChildrenMixin['layoutAlign'], string> = {
    MIN: 'align-self: flex-start',
    CENTER: 'align-self: center',
    MAX: 'align-self: flex-end',
    STRETCH: '',　// stretchをつけると左右センタリングが効かなくなるので、ここでは設定しない
    INHERIT: 'align-self: inherit'
};

/**
 * サイズの制約（min-width, max-width, min-height, max-height）を設定に追加する
 * @param node - Figmaノード
 * @param styles - 追加先のスタイル配列
 */
function addSizeConstraints(node: SceneNode, styles: string[]): void {
    const constraints = [
        { prop: 'minWidth', style: 'min-width' },
        { prop: 'maxWidth', style: 'max-width' },
        { prop: 'minHeight', style: 'min-height' },
        { prop: 'maxHeight', style: 'max-height' }
    ] as const;

    constraints.forEach(({ prop, style }) => {
        const value = (node as any)[prop];
        if (typeof value === 'number' && value > 0) {
            styles.push(`${style}: ${Math.round(value)}px`);
        }
    });
}

/**
 * Auto Layout（Flex box）のスタイルを設定に追加する
 * - display: flex
 * - flex-direction
 * - flex-wrap
 * - アライメント設定
 * - gap
 * - padding
 * @param node - Figmaノード
 * @param styles - 追加先のスタイル配列
 */
function addAutoLayoutStyles(node: SceneNode, styles: string[]): void {
    if (!isAutoLayoutNode(node)) return;

    const layoutMode = node.layoutMode;
    styles.push('display: flex');
    styles.push(`flex-direction: ${layoutMode === 'HORIZONTAL' ? 'row' : 'column'}`);

    // Wrap設定
    if ('layoutWrap' in node && node.layoutWrap) {
        const wrapMap = { WRAP: 'wrap', NO_WRAP: 'nowrap' };
        styles.push(`flex-wrap: ${wrapMap[node.layoutWrap]}`);
    }

    // アライメント設定
    if (node.primaryAxisAlignItems in primaryAxisAlignMap) {
        styles.push(primaryAxisAlignMap[node.primaryAxisAlignItems]);
    }
    if (node.counterAxisAlignItems in counterAxisAlignMap) {
        styles.push(counterAxisAlignMap[node.counterAxisAlignItems]);
    }

    // Flex関連のプロパティ
    if ('layoutGrow' in node && typeof node.layoutGrow === 'number' && node.layoutGrow !== 0) {
        styles.push(`flex-grow: ${node.layoutGrow}`);
    }
    if ('layoutShrink' in node && typeof node.layoutShrink === 'number') {
        styles.push(`flex-shrink: ${node.layoutShrink}`);
    }
    if ('layoutAlign' in node && node.layoutAlign in layoutAlignMap) {
        styles.push(layoutAlignMap[node.layoutAlign as keyof typeof layoutAlignMap]);
    }

    // Gap と Padding
    if (node.itemSpacing > 0) {
        styles.push(`gap: ${node.itemSpacing}px`);
    }
    const padding = {
        top: node.paddingTop,
        right: node.paddingRight,
        bottom: node.paddingBottom,
        left: node.paddingLeft
    };
    if (Object.values(padding).some(v => v > 0)) {
        styles.push(`padding: ${padding.top}px ${padding.right}px ${padding.bottom}px ${padding.left}px`);
    }
}

/**
 * テキストノードのスタイルを設定に追加する
 * - フォントサイズ
 * - フォントウェイト
 * - フォントファミリー
 * - レタースペーシング
 * - 行の高さ
 * - テキストの配置
 * - テキストの装飾
 * @param node - テキストノード
 * @param styles - 追加先のスタイル配列
 */
function addTextStyles(node: TextNode, styles: string[]): void {
    // フォントスタイル
    if (typeof node.fontSize !== 'symbol') {
        styles.push(`font-size: ${node.fontSize}px`);
    }
    if (typeof node.fontWeight !== 'symbol') {
        styles.push(`font-weight: ${node.fontWeight}`);
    }
    if (typeof node.fontName !== 'symbol' && node.fontName?.family) {
        styles.push(`font-family: "${node.fontName.family}"`);
    }

    // レタースペーシング
    if (typeof node.letterSpacing !== 'symbol') {
        const spacing = typeof node.letterSpacing === 'object' ? node.letterSpacing.value : node.letterSpacing;
        if (spacing !== 0) {
            styles.push(`letter-spacing: ${spacing}px`);
        }
    }

    // そ他のテキストプロパティ
    if (node.lineHeight && typeof node.lineHeight === 'object' && 'value' in node.lineHeight) {
        styles.push(`line-height: ${node.lineHeight.value}px`);
    }
    if (node.textAlignHorizontal && typeof node.textAlignHorizontal !== 'symbol') {
        styles.push(`text-align: ${node.textAlignHorizontal.toLowerCase()}`);
    }
    if (node.textDecoration && typeof node.textDecoration !== 'symbol') {
        styles.push(`text-decoration: ${node.textDecoration.toLowerCase()}`);
    }
}

/**
 * 色に関するスタイルを設定に追加する
 * - テキストノードの場合: color
 * - その他のノードの場合: background-color
 * @param node - Figmaノード
 * @param styles - 追加先のスタイル配列
 */
function addColorStyles(node: SceneNode, styles: string[]): void {
    if (!('fills' in node) || !Array.isArray(node.fills) || node.fills.length === 0) return;

    const fill = node.fills[0] as SolidPaint;
    if (fill.type !== 'SOLID' || !fill.visible) return;

    const { r, g, b } = fill.color;
    const opacity = fill.opacity !== undefined ? fill.opacity : 1;
    const rgba = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${opacity})`;

    if (isTextNode(node)) {
        styles.push(`color: ${rgba}`);
    } else {
        styles.push(`background-color: ${rgba}`);
    }
}

/**
 * Figmaノードから必要なスタイルを全て生成する
 * - サイズ設定（width, height）
 * - Auto Layoutの設定
 * - テキストスタイル
 * - 色の設定
 * - 位置の設定（absolute positioning）
 * @param node - Figmaノード
 * @returns 生成されたスタイルの配列
 */
function generateNodeStyles(node: SceneNode): string[] {
    const styles: string[] = [];

    // サイズの設定
    if ('width' in node && 'height' in node) {
        if (isAutoLayoutNode(node)) {
            // widthの設定
            if (node.layoutMode === 'HORIZONTAL' || node.layoutMode === 'VERTICAL') {
                styles.push(widthStrategies[node.layoutMode](node));
            }

            // heightの設定
            const isAuto = node.layoutMode === 'VERTICAL'
                ? node.primaryAxisSizingMode === 'AUTO'
                : node.counterAxisSizingMode === 'AUTO';
            styles.push(isAuto ? 'height: fit-content' : `height: ${Math.round(node.height)}px`);

            addSizeConstraints(node, styles);
            addAutoLayoutStyles(node, styles);
        } else if (node.type === 'TEXT') {
            styles.push('width: auto');
            styles.push('height: fit-content');
            addSizeConstraints(node, styles);
            addTextStyles(node, styles);
        } else {
            const hasParentFrame = 'parent' in node && node.parent?.type === 'FRAME';
            const isImage = node.type === 'RECTANGLE' && 'fills' in node && Array.isArray(node.fills) &&
                node.fills.length > 0 && node.fills[0].type === 'IMAGE';

            styles.push(hasParentFrame
                ? `width: ${Math.round((node.width / node.parent.width) * 100)}%`
                : `width: ${Math.round(node.width)}px`
            );

            // 画像の場合は height: auto を設定
            styles.push(isImage ? 'height: auto' : `height: ${Math.round(node.height)}px`);
            addSizeConstraints(node, styles);
        }
    }

    // 色設定
    addColorStyles(node, styles);

    // 位置の設定
    if ('layoutPositioning' in node && node.layoutPositioning === 'ABSOLUTE') {
        styles.push('position: absolute');
        styles.push(`left: ${Math.round(node.x)}px`);
        styles.push(`top: ${Math.round(node.y)}px`);
    }

    return styles;
}

/**
 * HTML要素のデータ構造からSCSSを生成する
 * - セレクタとスタイルの収集
 * - position: absoluteの要素に対する親要素の処理
 * - SCSSの整形と出力
 * @param elementData - HTML要素のデータ構造
 * @returns 生成されたSCSS文字列
 */
export function generateSCSS(elementData: ElementData): string {
    const selectors: string[] = [];
    const styles: Record<string, Set<string>> = {};
    const absoluteElements: Set<string> = new Set();

    function collectSelectorsAndStyles(element: ElementData) {
        const { tag, classes, _node } = element;
        const currentSelector = classes?.length
            ? '.' + classes.filter(cls => !cls.startsWith('js-')).join('.')
            : tag !== 'picture' ? tag : '';

        if (currentSelector) {
            selectors.push(currentSelector);
            styles[currentSelector] = styles[currentSelector] || new Set();

            if (_node) {
                const nodeStyles = generateNodeStyles(_node);
                nodeStyles.forEach(style => styles[currentSelector].add(style));
                if (nodeStyles.includes('position: absolute')) {
                    absoluteElements.add(currentSelector);
                }
            }
        }

        element.children?.forEach(child => collectSelectorsAndStyles(child));
    }

    collectSelectorsAndStyles(elementData);

    // position: absolute をつ素の親フレームに position: relative を加
    absoluteElements.forEach(absoluteSelector => {
        function addPositionRelative(element: ElementData): boolean {
            const currentSelector = element.classes?.length
                ? '.' + element.classes.filter(cls => !cls.startsWith('js-')).join('.')
                : element.tag !== 'picture' ? element.tag : '';

            for (const child of element.children || []) {
                const childSelector = child.classes?.length
                    ? '.' + child.classes.filter(cls => !cls.startsWith('js-')).join('.')
                    : child.tag !== 'picture' ? child.tag : '';

                if (childSelector === absoluteSelector) {
                    if (currentSelector && element._node?.type === 'FRAME') {
                        styles[currentSelector].add('position: relative');
                        return true;
                    }
                }

                if (addPositionRelative(child)) return true;
            }
            return false;
        }

        addPositionRelative(elementData);
    });

    // SCSSの生成
    return [...new Set(selectors)]
        .map(selector => {
            const styleArray = [...styles[selector]];
            return styleArray.length > 0
                ? `${selector} {\n  ${styleArray.join(';\n  ')};\n}\n`
                : '';
        })
        .filter(Boolean)
        .join('\n');
} 
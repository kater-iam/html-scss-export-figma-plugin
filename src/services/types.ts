/**
 * HTML要素のデータ構造を表すインターフェース
 */
export interface ElementData {
  /** HTML要素のタグ名 */
  tag: string;
  /** CSSクラス名の配列 */
  classes?: string[];
  /** HTML属性のキーと値のペア */
  attributes?: Record<string, string>;
  /** 子要素の配列 */
  children: ElementData[];
  /** テキストコンテンツ */
  text?: string;
  /** Figmaのノードへの参照 */
  _node?: SceneNode;
}

/**
 * レイヤー名から解析されたHTML要素の情報を表すインターフェース
 */
export interface ParsedNodeName {
  /** HTML要素のタグ名 */
  tag: string;
  /** CSSクラス名の配列 */
  classes: string[];
  /** HTML属性のキーと値のペア */
  attributes: Record<string, string>;
} 
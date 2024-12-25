export function getTopLevelFrames(): FrameNode[] {
  return figma.currentPage.children
    .filter((node): node is FrameNode => node.type === 'FRAME' && node.parent === figma.currentPage);
} 
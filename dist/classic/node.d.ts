/**
 * Flexture Node
 *
 * Yoga-compatible Node class for flexbox layout.
 */
import { type BaselineFunc, type Layout, type MeasureFunc, type Style, type Value } from "../types.js";
/**
 * A layout node in the flexbox tree.
 */
export declare class Node {
    private _parent;
    private _children;
    private _style;
    private _measureFunc;
    private _baselineFunc;
    private _layout;
    private _isDirty;
    private _hasNewLayout;
    /**
     * Create a new layout node.
     *
     * @returns A new Node instance
     * @example
     * ```typescript
     * const root = Node.create();
     * root.setWidth(100);
     * root.setHeight(200);
     * ```
     */
    static create(): Node;
    /**
     * Get the number of child nodes.
     *
     * @returns The number of children
     */
    getChildCount(): number;
    /**
     * Get a child node by index.
     *
     * @param index - Zero-based child index
     * @returns The child node at the given index, or undefined if index is out of bounds
     */
    getChild(index: number): Node | undefined;
    /**
     * Get the parent node.
     *
     * @returns The parent node, or null if this is a root node
     */
    getParent(): Node | null;
    /**
     * Insert a child node at the specified index.
     * If the child already has a parent, it will be removed from that parent first.
     * Marks the node as dirty to trigger layout recalculation.
     *
     * @param child - The child node to insert
     * @param index - The index at which to insert the child
     * @example
     * ```typescript
     * const parent = Node.create();
     * const child1 = Node.create();
     * const child2 = Node.create();
     * parent.insertChild(child1, 0);
     * parent.insertChild(child2, 1);
     * ```
     */
    insertChild(child: Node, index: number): void;
    /**
     * Remove a child node from this node.
     * The child's parent reference will be cleared.
     * Marks the node as dirty to trigger layout recalculation.
     *
     * @param child - The child node to remove
     */
    removeChild(child: Node): void;
    /**
     * Free this node and clean up all references.
     * Removes the node from its parent, clears all children, and removes the measure function.
     * This does not recursively free child nodes.
     */
    free(): void;
    /**
     * Dispose the node (calls free)
     */
    [Symbol.dispose](): void;
    /**
     * Set a measure function for intrinsic sizing.
     * The measure function is called during layout to determine the node's natural size.
     * Typically used for text nodes or other content that has an intrinsic size.
     * Marks the node as dirty to trigger layout recalculation.
     *
     * @param measureFunc - Function that returns width and height given available space and constraints
     * @example
     * ```typescript
     * const textNode = Node.create();
     * textNode.setMeasureFunc((width, widthMode, height, heightMode) => {
     *   // Measure text and return dimensions
     *   return { width: 50, height: 20 };
     * });
     * ```
     */
    setMeasureFunc(measureFunc: MeasureFunc): void;
    /**
     * Remove the measure function from this node.
     * Marks the node as dirty to trigger layout recalculation.
     */
    unsetMeasureFunc(): void;
    /**
     * Check if this node has a measure function.
     *
     * @returns True if a measure function is set
     */
    hasMeasureFunc(): boolean;
    /**
     * Set a baseline function to determine where this node's text baseline is.
     * Used for ALIGN_BASELINE to align text across siblings with different heights.
     *
     * @param baselineFunc - Function that returns baseline offset from top given width and height
     * @example
     * ```typescript
     * textNode.setBaselineFunc((width, height) => {
     *   // For a text node, baseline might be at 80% of height
     *   return height * 0.8;
     * });
     * ```
     */
    setBaselineFunc(baselineFunc: BaselineFunc): void;
    /**
     * Remove the baseline function from this node.
     * Marks the node as dirty to trigger layout recalculation.
     */
    unsetBaselineFunc(): void;
    /**
     * Check if this node has a baseline function.
     *
     * @returns True if a baseline function is set
     */
    hasBaselineFunc(): boolean;
    /**
     * Check if this node needs layout recalculation.
     *
     * @returns True if the node is dirty and needs layout
     */
    isDirty(): boolean;
    /**
     * Mark this node and all ancestors as dirty.
     * A dirty node needs layout recalculation.
     * This is automatically called by all style setters and tree operations.
     */
    markDirty(): void;
    /**
     * Check if this node has new layout results since the last check.
     *
     * @returns True if layout was recalculated since the last call to markLayoutSeen
     */
    hasNewLayout(): boolean;
    /**
     * Mark that the current layout has been seen/processed.
     * Clears the hasNewLayout flag.
     */
    markLayoutSeen(): void;
    /**
     * Calculate layout for this node and all descendants.
     * This runs the flexbox layout algorithm to compute positions and sizes.
     * Only recalculates if the node is marked as dirty.
     *
     * @param width - Available width for layout
     * @param height - Available height for layout
     * @param _direction - Text direction (LTR or RTL), defaults to LTR
     * @example
     * ```typescript
     * const root = Node.create();
     * root.setFlexDirection(FLEX_DIRECTION_ROW);
     * root.setWidth(100);
     * root.setHeight(50);
     *
     * const child = Node.create();
     * child.setFlexGrow(1);
     * root.insertChild(child, 0);
     *
     * root.calculateLayout(100, 50, DIRECTION_LTR);
     *
     * // Now you can read computed layout
     * console.log(child.getComputedWidth());
     * ```
     */
    calculateLayout(width?: number, height?: number, _direction?: number): void;
    /**
     * Get the computed left position after layout.
     *
     * @returns The left position in points
     */
    getComputedLeft(): number;
    /**
     * Get the computed top position after layout.
     *
     * @returns The top position in points
     */
    getComputedTop(): number;
    /**
     * Get the computed width after layout.
     *
     * @returns The width in points
     */
    getComputedWidth(): number;
    /**
     * Get the computed height after layout.
     *
     * @returns The height in points
     */
    getComputedHeight(): number;
    get children(): readonly Node[];
    get style(): Style;
    get layout(): Layout;
    get measureFunc(): MeasureFunc | null;
    get baselineFunc(): BaselineFunc | null;
    /**
     * Set the width to a fixed value in points.
     *
     * @param value - Width in points
     */
    setWidth(value: number): void;
    /**
     * Set the width as a percentage of the parent's width.
     *
     * @param value - Width as a percentage (0-100)
     */
    setWidthPercent(value: number): void;
    /**
     * Set the width to auto (determined by layout algorithm).
     */
    setWidthAuto(): void;
    /**
     * Set the height to a fixed value in points.
     *
     * @param value - Height in points
     */
    setHeight(value: number): void;
    /**
     * Set the height as a percentage of the parent's height.
     *
     * @param value - Height as a percentage (0-100)
     */
    setHeightPercent(value: number): void;
    /**
     * Set the height to auto (determined by layout algorithm).
     */
    setHeightAuto(): void;
    /**
     * Set the minimum width in points.
     *
     * @param value - Minimum width in points
     */
    setMinWidth(value: number): void;
    /**
     * Set the minimum width as a percentage of the parent's width.
     *
     * @param value - Minimum width as a percentage (0-100)
     */
    setMinWidthPercent(value: number): void;
    /**
     * Set the minimum height in points.
     *
     * @param value - Minimum height in points
     */
    setMinHeight(value: number): void;
    /**
     * Set the minimum height as a percentage of the parent's height.
     *
     * @param value - Minimum height as a percentage (0-100)
     */
    setMinHeightPercent(value: number): void;
    /**
     * Set the maximum width in points.
     *
     * @param value - Maximum width in points
     */
    setMaxWidth(value: number): void;
    /**
     * Set the maximum width as a percentage of the parent's width.
     *
     * @param value - Maximum width as a percentage (0-100)
     */
    setMaxWidthPercent(value: number): void;
    /**
     * Set the maximum height in points.
     *
     * @param value - Maximum height in points
     */
    setMaxHeight(value: number): void;
    /**
     * Set the maximum height as a percentage of the parent's height.
     *
     * @param value - Maximum height as a percentage (0-100)
     */
    setMaxHeightPercent(value: number): void;
    /**
     * Set the aspect ratio of the node.
     * When set, the node's width/height relationship is constrained.
     * If width is defined, height = width / aspectRatio.
     * If height is defined, width = height * aspectRatio.
     *
     * @param value - Aspect ratio (width/height). Use NaN to unset.
     */
    setAspectRatio(value: number): void;
    /**
     * Set the flex grow factor.
     * Determines how much the node will grow relative to siblings when there is extra space.
     *
     * @param value - Flex grow factor (typically 0 or 1+)
     * @example
     * ```typescript
     * const child = Node.create();
     * child.setFlexGrow(1); // Will grow to fill available space
     * ```
     */
    setFlexGrow(value: number): void;
    /**
     * Set the flex shrink factor.
     * Determines how much the node will shrink relative to siblings when there is insufficient space.
     *
     * @param value - Flex shrink factor (default is 1)
     */
    setFlexShrink(value: number): void;
    /**
     * Set the flex basis to a fixed value in points.
     * The initial size of the node before flex grow/shrink is applied.
     *
     * @param value - Flex basis in points
     */
    setFlexBasis(value: number): void;
    /**
     * Set the flex basis as a percentage of the parent's size.
     *
     * @param value - Flex basis as a percentage (0-100)
     */
    setFlexBasisPercent(value: number): void;
    /**
     * Set the flex basis to auto (based on the node's width/height).
     */
    setFlexBasisAuto(): void;
    /**
     * Set the flex direction (main axis direction).
     *
     * @param direction - FLEX_DIRECTION_ROW, FLEX_DIRECTION_COLUMN, FLEX_DIRECTION_ROW_REVERSE, or FLEX_DIRECTION_COLUMN_REVERSE
     * @example
     * ```typescript
     * const container = Node.create();
     * container.setFlexDirection(FLEX_DIRECTION_ROW); // Lay out children horizontally
     * ```
     */
    setFlexDirection(direction: number): void;
    /**
     * Set the flex wrap behavior.
     *
     * @param wrap - WRAP_NO_WRAP, WRAP_WRAP, or WRAP_WRAP_REVERSE
     */
    setFlexWrap(wrap: number): void;
    /**
     * Set how children are aligned along the cross axis.
     *
     * @param align - ALIGN_FLEX_START, ALIGN_CENTER, ALIGN_FLEX_END, ALIGN_STRETCH, or ALIGN_BASELINE
     * @example
     * ```typescript
     * const container = Node.create();
     * container.setFlexDirection(FLEX_DIRECTION_ROW);
     * container.setAlignItems(ALIGN_CENTER); // Center children vertically
     * ```
     */
    setAlignItems(align: number): void;
    /**
     * Set how this node is aligned along the parent's cross axis.
     * Overrides the parent's alignItems for this specific child.
     *
     * @param align - ALIGN_AUTO, ALIGN_FLEX_START, ALIGN_CENTER, ALIGN_FLEX_END, ALIGN_STRETCH, or ALIGN_BASELINE
     */
    setAlignSelf(align: number): void;
    /**
     * Set how lines are aligned in a multi-line flex container.
     * Only affects containers with wrap enabled and multiple lines.
     *
     * @param align - ALIGN_FLEX_START, ALIGN_CENTER, ALIGN_FLEX_END, ALIGN_STRETCH, ALIGN_SPACE_BETWEEN, or ALIGN_SPACE_AROUND
     */
    setAlignContent(align: number): void;
    /**
     * Set how children are distributed along the main axis.
     *
     * @param justify - JUSTIFY_FLEX_START, JUSTIFY_CENTER, JUSTIFY_FLEX_END, JUSTIFY_SPACE_BETWEEN, JUSTIFY_SPACE_AROUND, or JUSTIFY_SPACE_EVENLY
     * @example
     * ```typescript
     * const container = Node.create();
     * container.setJustifyContent(JUSTIFY_SPACE_BETWEEN); // Space children evenly with edges at start/end
     * ```
     */
    setJustifyContent(justify: number): void;
    /**
     * Set padding for one or more edges.
     *
     * @param edge - EDGE_LEFT, EDGE_TOP, EDGE_RIGHT, EDGE_BOTTOM, EDGE_HORIZONTAL, EDGE_VERTICAL, or EDGE_ALL
     * @param value - Padding in points
     * @example
     * ```typescript
     * node.setPadding(EDGE_ALL, 10); // Set 10pt padding on all edges
     * node.setPadding(EDGE_HORIZONTAL, 5); // Set 5pt padding on left and right
     * ```
     */
    setPadding(edge: number, value: number): void;
    /**
     * Set padding as a percentage of the parent's width.
     * Per CSS spec, percentage padding always resolves against the containing block's width.
     *
     * @param edge - EDGE_LEFT, EDGE_TOP, EDGE_RIGHT, EDGE_BOTTOM, EDGE_HORIZONTAL, EDGE_VERTICAL, or EDGE_ALL
     * @param value - Padding as a percentage (0-100)
     */
    setPaddingPercent(edge: number, value: number): void;
    /**
     * Set margin for one or more edges.
     *
     * @param edge - EDGE_LEFT, EDGE_TOP, EDGE_RIGHT, EDGE_BOTTOM, EDGE_HORIZONTAL, EDGE_VERTICAL, or EDGE_ALL
     * @param value - Margin in points
     * @example
     * ```typescript
     * node.setMargin(EDGE_ALL, 5); // Set 5pt margin on all edges
     * node.setMargin(EDGE_TOP, 10); // Set 10pt margin on top only
     * ```
     */
    setMargin(edge: number, value: number): void;
    /**
     * Set margin as a percentage of the parent's size.
     *
     * @param edge - EDGE_LEFT, EDGE_TOP, EDGE_RIGHT, EDGE_BOTTOM, EDGE_HORIZONTAL, EDGE_VERTICAL, or EDGE_ALL
     * @param value - Margin as a percentage (0-100)
     */
    setMarginPercent(edge: number, value: number): void;
    /**
     * Set margin to auto (for centering items with margin: auto).
     *
     * @param edge - EDGE_LEFT, EDGE_TOP, EDGE_RIGHT, EDGE_BOTTOM, EDGE_HORIZONTAL, EDGE_VERTICAL, or EDGE_ALL
     */
    setMarginAuto(edge: number): void;
    /**
     * Set border width for one or more edges.
     *
     * @param edge - EDGE_LEFT, EDGE_TOP, EDGE_RIGHT, EDGE_BOTTOM, EDGE_HORIZONTAL, EDGE_VERTICAL, or EDGE_ALL
     * @param value - Border width in points
     */
    setBorder(edge: number, value: number): void;
    /**
     * Set gap between flex items.
     *
     * @param gutter - GUTTER_COLUMN (horizontal gap), GUTTER_ROW (vertical gap), or GUTTER_ALL (both)
     * @param value - Gap size in points
     * @example
     * ```typescript
     * container.setGap(GUTTER_ALL, 8); // Set 8pt gap between all items
     * container.setGap(GUTTER_COLUMN, 10); // Set 10pt horizontal gap only
     * ```
     */
    setGap(gutter: number, value: number): void;
    /**
     * Set the position type.
     *
     * @param positionType - POSITION_TYPE_STATIC, POSITION_TYPE_RELATIVE, or POSITION_TYPE_ABSOLUTE
     * @example
     * ```typescript
     * node.setPositionType(POSITION_TYPE_ABSOLUTE);
     * node.setPosition(EDGE_LEFT, 10);
     * node.setPosition(EDGE_TOP, 20);
     * ```
     */
    setPositionType(positionType: number): void;
    /**
     * Set position offset for one or more edges.
     * Only applies when position type is ABSOLUTE or RELATIVE.
     *
     * @param edge - EDGE_LEFT, EDGE_TOP, EDGE_RIGHT, EDGE_BOTTOM, EDGE_HORIZONTAL, EDGE_VERTICAL, or EDGE_ALL
     * @param value - Position offset in points
     */
    setPosition(edge: number, value: number): void;
    /**
     * Set position offset as a percentage.
     *
     * @param edge - EDGE_LEFT, EDGE_TOP, EDGE_RIGHT, EDGE_BOTTOM, EDGE_HORIZONTAL, EDGE_VERTICAL, or EDGE_ALL
     * @param value - Position offset as a percentage of parent's corresponding dimension
     */
    setPositionPercent(edge: number, value: number): void;
    /**
     * Set the display type.
     *
     * @param display - DISPLAY_FLEX or DISPLAY_NONE
     */
    setDisplay(display: number): void;
    /**
     * Set the overflow behavior.
     *
     * @param overflow - OVERFLOW_VISIBLE, OVERFLOW_HIDDEN, or OVERFLOW_SCROLL
     */
    setOverflow(overflow: number): void;
    /**
     * Get the width style value.
     *
     * @returns Width value with unit (points, percent, or auto)
     */
    getWidth(): Value;
    /**
     * Get the height style value.
     *
     * @returns Height value with unit (points, percent, or auto)
     */
    getHeight(): Value;
    /**
     * Get the minimum width style value.
     *
     * @returns Minimum width value with unit
     */
    getMinWidth(): Value;
    /**
     * Get the minimum height style value.
     *
     * @returns Minimum height value with unit
     */
    getMinHeight(): Value;
    /**
     * Get the maximum width style value.
     *
     * @returns Maximum width value with unit
     */
    getMaxWidth(): Value;
    /**
     * Get the maximum height style value.
     *
     * @returns Maximum height value with unit
     */
    getMaxHeight(): Value;
    /**
     * Get the aspect ratio.
     *
     * @returns Aspect ratio value (NaN if not set)
     */
    getAspectRatio(): number;
    /**
     * Get the flex grow factor.
     *
     * @returns Flex grow value
     */
    getFlexGrow(): number;
    /**
     * Get the flex shrink factor.
     *
     * @returns Flex shrink value
     */
    getFlexShrink(): number;
    /**
     * Get the flex basis style value.
     *
     * @returns Flex basis value with unit
     */
    getFlexBasis(): Value;
    /**
     * Get the flex direction.
     *
     * @returns Flex direction constant
     */
    getFlexDirection(): number;
    /**
     * Get the flex wrap setting.
     *
     * @returns Flex wrap constant
     */
    getFlexWrap(): number;
    /**
     * Get the align items setting.
     *
     * @returns Align items constant
     */
    getAlignItems(): number;
    /**
     * Get the align self setting.
     *
     * @returns Align self constant
     */
    getAlignSelf(): number;
    /**
     * Get the align content setting.
     *
     * @returns Align content constant
     */
    getAlignContent(): number;
    /**
     * Get the justify content setting.
     *
     * @returns Justify content constant
     */
    getJustifyContent(): number;
    /**
     * Get the padding for a specific edge.
     *
     * @param edge - EDGE_LEFT, EDGE_TOP, EDGE_RIGHT, or EDGE_BOTTOM
     * @returns Padding value with unit
     */
    getPadding(edge: number): Value;
    /**
     * Get the margin for a specific edge.
     *
     * @param edge - EDGE_LEFT, EDGE_TOP, EDGE_RIGHT, or EDGE_BOTTOM
     * @returns Margin value with unit
     */
    getMargin(edge: number): Value;
    /**
     * Get the border width for a specific edge.
     *
     * @param edge - EDGE_LEFT, EDGE_TOP, EDGE_RIGHT, or EDGE_BOTTOM
     * @returns Border width in points
     */
    getBorder(edge: number): number;
    /**
     * Get the position offset for a specific edge.
     *
     * @param edge - EDGE_LEFT, EDGE_TOP, EDGE_RIGHT, or EDGE_BOTTOM
     * @returns Position value with unit
     */
    getPosition(edge: number): Value;
    /**
     * Get the position type.
     *
     * @returns Position type constant
     */
    getPositionType(): number;
    /**
     * Get the display type.
     *
     * @returns Display constant
     */
    getDisplay(): number;
    /**
     * Get the overflow setting.
     *
     * @returns Overflow constant
     */
    getOverflow(): number;
    /**
     * Get the gap for column or row.
     *
     * @param gutter - GUTTER_COLUMN or GUTTER_ROW
     * @returns Gap size in points
     */
    getGap(gutter: number): number;
}
//# sourceMappingURL=node.d.ts.map
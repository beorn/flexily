/**
 * Flexture Types
 *
 * TypeScript interfaces for the flexbox layout engine.
 */
/**
 * Create a default Value (undefined).
 */
export function createValue(value = 0, unit = 0) {
    return { value, unit };
}
/**
 * Create default style.
 */
export function createDefaultStyle() {
    return {
        display: 0, // DISPLAY_FLEX
        positionType: 1, // POSITION_TYPE_RELATIVE
        position: [createValue(), createValue(), createValue(), createValue(), createValue(), createValue()],
        flexDirection: 0, // FLEX_DIRECTION_COLUMN (Yoga default, not CSS!)
        flexWrap: 0, // WRAP_NO_WRAP
        flexGrow: 0,
        flexShrink: 0, // Yoga native default (CSS uses 1)
        flexBasis: createValue(0, 3), // AUTO
        alignItems: 4, // ALIGN_STRETCH
        alignSelf: 0, // ALIGN_AUTO
        alignContent: 1, // ALIGN_FLEX_START
        justifyContent: 0, // JUSTIFY_FLEX_START
        width: createValue(0, 3), // AUTO
        height: createValue(0, 3), // AUTO
        minWidth: createValue(),
        minHeight: createValue(),
        maxWidth: createValue(),
        maxHeight: createValue(),
        aspectRatio: NaN, // undefined by default
        margin: [createValue(), createValue(), createValue(), createValue(), createValue(), createValue()],
        padding: [createValue(), createValue(), createValue(), createValue(), createValue(), createValue()],
        border: [0, 0, 0, 0, NaN, NaN],
        gap: [0, 0],
        overflow: 0, // OVERFLOW_VISIBLE
    };
}
//# sourceMappingURL=types.js.map
import { useState, useCallback, useRef, useMemo } from "preact/hooks";
import { log } from "../utils/logger";

const createSelectionAccessor = (state) => {
    return {
        has(index) {
            if (state.mode === "all") {
                return index >= 0 && index < state.totalCount && !state.excluded.has(index);
            }
            return state.included.has(index);
        },
        get size() {
            if (state.mode === "all") {
                const computed = state.totalCount - state.excluded.size;
                return computed > 0 ? computed : 0;
            }
            return state.included.size;
        },
        [Symbol.iterator]() {
            if (state.mode === "all") {
                let index = 0;
                const { totalCount, excluded } = state;
                return {
                    next() {
                        while (index < totalCount && excluded.has(index)) {
                            index += 1;
                        }
                        if (index >= totalCount) {
                            return { done: true };
                        }
                        return { value: index++, done: false };
                    },
                };
            }
            return state.included.values();
        },
    };
};

const clampExcluded = (excluded, total) => {
    if (!excluded || excluded.size === 0) {
        return new Set();
    }
    const next = new Set();
    excluded.forEach((idx) => {
        if (idx < total) {
            next.add(idx);
        }
    });
    return next;
};

const getPrimaryIndex = (state, total) => {
    if (state.mode === "all") {
        if (state.excluded.size >= total) {
            return null;
        }
        if (state.lastSelectedIndex >= 0 && !state.excluded.has(state.lastSelectedIndex) && state.lastSelectedIndex < total) {
            return state.lastSelectedIndex;
        }
        for (let i = 0; i < total; i += 1) {
            if (!state.excluded.has(i)) {
                return i;
            }
        }
        return null;
    }

    if (state.included.size === 0) {
        return null;
    }

    if (state.included.size === 1) {
        return state.included.values().next().value;
    }

    if (state.lastSelectedIndex >= 0 && state.included.has(state.lastSelectedIndex)) {
        return state.lastSelectedIndex;
    }

    return state.included.values().next().value;
};

export const useSelection = (scrollToItem) => {
    const [selectionState, setSelectionState] = useState({
        mode: "explicit",
        included: new Set(),
        excluded: new Set(),
        lastSelectedIndex: -1,
        totalCount: 0,
    });
    const scrollTimeoutRef = useRef(null);

    const selectedFiles = useMemo(() => createSelectionAccessor(selectionState), [selectionState]);

    const updateTotalCount = useCallback((total) => {
        setSelectionState((prev) => {
            if (prev.totalCount === total) {
                return prev;
            }
            if (prev.mode === "all") {
                return {
                    ...prev,
                    totalCount: total,
                    excluded: clampExcluded(prev.excluded, total),
                };
            }
            return {
                ...prev,
                totalCount: total,
            };
        });
    }, []);

    const handleFileSelect = useCallback((fileIndex, isShiftKey, isCtrlKey) => {
        log("📋 File selection:", fileIndex, "Shift:", isShiftKey, "Ctrl:", isCtrlKey);

        setSelectionState((prev) => {
            const nextTotal = Math.max(prev.totalCount, fileIndex + 1);

            if (isShiftKey && prev.lastSelectedIndex !== -1) {
                const start = Math.min(prev.lastSelectedIndex, fileIndex);
                const end = Math.max(prev.lastSelectedIndex, fileIndex);
                const included = new Set();
                for (let i = start; i <= end; i += 1) {
                    included.add(i);
                }
                return {
                    mode: "explicit",
                    included,
                    excluded: new Set(),
                    lastSelectedIndex: fileIndex,
                    totalCount: Math.max(nextTotal, end + 1),
                };
            }

            if (isCtrlKey) {
                if (prev.mode === "all") {
                    const excluded = new Set(prev.excluded);
                    if (excluded.has(fileIndex)) {
                        excluded.delete(fileIndex);
                    } else {
                        excluded.add(fileIndex);
                    }
                    return {
                        ...prev,
                        excluded,
                        lastSelectedIndex: fileIndex,
                        totalCount: Math.max(nextTotal, prev.totalCount),
                    };
                }

                const included = new Set(prev.included);
                if (included.has(fileIndex)) {
                    included.delete(fileIndex);
                } else {
                    included.add(fileIndex);
                }
                return {
                    mode: "explicit",
                    included,
                    excluded: new Set(),
                    lastSelectedIndex: fileIndex,
                    totalCount: Math.max(nextTotal, prev.totalCount),
                };
            }

            return {
                mode: "explicit",
                included: new Set([fileIndex]),
                excluded: new Set(),
                lastSelectedIndex: fileIndex,
                totalCount: Math.max(nextTotal, prev.totalCount),
            };
        });
    }, []);

    const clearSelection = useCallback(() => {
        setSelectionState((prev) => ({
            mode: "explicit",
            included: new Set(),
            excluded: new Set(),
            lastSelectedIndex: -1,
            totalCount: prev.totalCount,
        }));
        log("📋 Cleared selection");
    }, []);

    const selectAll = useCallback((totalFiles) => {
        setSelectionState({
            mode: "all",
            included: new Set(),
            excluded: new Set(),
            lastSelectedIndex: totalFiles > 0 ? totalFiles - 1 : -1,
            totalCount: totalFiles,
        });
        log("📋 Selected all files:", totalFiles);
    }, []);

    const handleArrowNavigation = useCallback((direction, allFiles) => {
        if (allFiles.length === 0) return;

        const total = allFiles.length;
        const currentIndex = getPrimaryIndex(selectionState, total);

        let targetIndex;
        if (currentIndex !== null && currentIndex !== undefined) {
            if (direction === "up") {
                targetIndex = currentIndex > 0 ? currentIndex - 1 : total - 1;
            } else {
                targetIndex = currentIndex < total - 1 ? currentIndex + 1 : 0;
            }
        } else {
            targetIndex = direction === "up" ? total - 1 : 0;
        }

        log(`Arrow navigation ${direction}: moving to index ${targetIndex} (${allFiles[targetIndex]?.name})`);

        setSelectionState({
            mode: "explicit",
            included: new Set([targetIndex]),
            excluded: new Set(),
            lastSelectedIndex: targetIndex,
            totalCount: Math.max(selectionState.totalCount, total),
        });

        if (scrollToItem && typeof scrollToItem === "function") {
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
            scrollTimeoutRef.current = setTimeout(() => {
                scrollToItem(targetIndex);
                scrollTimeoutRef.current = null;
            }, 16);
        }

        return targetIndex;
    }, [selectionState, scrollToItem]);

    return {
        selectedFiles,
        lastSelectedIndex: selectionState.lastSelectedIndex,
        handleFileSelect,
        clearSelection,
        selectAll,
        handleArrowNavigation,
        updateTotalCount,
    };
};

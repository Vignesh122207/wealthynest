/** Format a number to max 2dp, stripping trailing zeros: 10.00→"10", 106.67→"106.67", 10.50→"10.5" */
export const fmtNum = (v: number) => parseFloat(v.toFixed(2)).toString();

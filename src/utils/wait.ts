/**
 * 等待指定的毫秒数
 * @param ms 等待的毫秒数，默认为 0
 * @returns Promise，在指定时间后 resolve
 */
export const wait = (ms: number = 0): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};


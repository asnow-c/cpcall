import type { RpcFrame } from "../core/type.ts";

/** CpCall 构造函数依赖的接口。你可以实现自定义编解码器，或数据帧转发服务
 * @public
 */
export type CpcFrameSource<T = RpcFrame> = {
  /** 当需要发送数据帧时被调用*/
  sendFrame(frame: T): void;
  /**
   * 初始化时被调用，在构造函数是，它是同步调用的。
   * @param controller - CpCall 实例的控制器
   */
  init(controller: CpcController<T>): void;
  /**
   * 实例正常关闭时调用。它在 closeEvent 触发前被调用，如果返回Promise，则在 Promise 解决后 触发 closeEvent
   * 如果 调用 close() 是抛出异常，则会调用 dispose()
   */
  close(): void | Promise<void>;
  /** 当用户手动调用 dispose() 时或出现异常时调用。dispose() 调用时如果抛出异常，不会被 CpCall 捕获  */
  dispose(reason?: any): void;
};

/**  CpCall 实例的控制器
 * @public
 */
export type CpcController<T = RpcFrame> = {
  /** 当获取到帧时，应当调用它传给 CpCall 内部 */
  nextFrame(frame: T): void;
  /** 如果不会再有更多帧，应该调用它，CpCall 内部会判断是正常关闭还是异常关闭 */
  endFrame(error?: any): void;
};

/** @public */
export type ServeFnConfig = {
  /** 参数转换 */
  interceptCall?(args: any[]): any[];
  /** 返回拦截器 */
  interceptReturn?(data: any): any;
};

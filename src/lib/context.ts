/**
 * @leizm/web 中间件基础框架
 * @author Zongmin Lei <leizongmin@gmail.com>
 */

import { IncomingMessage, ServerResponse } from "http";
import { EventEmitter } from "events";
import { Request } from "./request";
import { Response } from "./response";
import { Application } from "./application";
import {
  RawRouteInfo,
  NextFunction,
  ErrorReason,
  RequestConstructor,
  ResponseConstructor,
  SYMBOL_APPLICATION,
  SYMBOL_SESSION,
  SYMBOL_PUSH_NEXT_HANDLE,
  SYMBOL_POP_NEXT_HANDLE,
  SYMBOL_RAW_ROUTE_INFO,
} from "./define";
import { SessionInstance } from "./component/session";
import onWriteHead from "./module/on.writehead";
import { proxyRequest, ProxyTarget, parseProxyTarget } from "./module/proxy.request";

export class Context<Q extends Request = Request, S extends Response = Response> extends EventEmitter {
  /** 原始ServerRequest对象 */
  protected _request?: Q;
  /** 原始ServerResponse对象 */
  protected _response?: S;
  /** 用于存储next函数的堆栈 */
  protected readonly nextHandleStack: NextFunction[] = [];
  /** Request对象的构造函数 */
  protected requestConstructor: RequestConstructor = Request;
  /** Response对象的构造函数 */
  protected responseConstructor: ResponseConstructor = Response;

  /** 父 Application 实例 */
  public [SYMBOL_APPLICATION]?: Application;

  /** 原始 Session对象 */
  public [SYMBOL_SESSION]?: SessionInstance;
  /** Session对象 */
  public get session(): SessionInstance {
    if (this[SYMBOL_SESSION]) return this[SYMBOL_SESSION];
    throw new Error(`ctx.session: please use component.session() middleware firstly`);
  }

  /** 原始路由信息 */
  public [SYMBOL_RAW_ROUTE_INFO]?: RawRouteInfo;

  /** 其他可任意挂载在Context上的数据 */
  public data: Record<string | number | symbol, any> = {};

  /**
   * 创建Request对象
   *
   * @param req 原始ServerRequest对象
   */
  protected createRequest(req: IncomingMessage): Q {
    return new this.requestConstructor(req, this) as Q;
  }

  /**
   * 创建Response对象
   *
   * @param res 原始ServerResponse对象
   */
  protected createResponse(res: ServerResponse): S {
    return new this.responseConstructor(res, this) as S;
  }

  /**
   * 初始化
   *
   * @param req 原始ServerRequest对象
   * @param res 原始ServerResponse对象
   */
  public init(req: IncomingMessage, res: ServerResponse) {
    this._request = this.createRequest(req);
    this._request.inited();
    this._response = this.createResponse(res);
    this._response.inited();
    this.response.setHeader("X-Powered-By", "@leizm/web");
    res.once("finish", () => this.emit("finish"));
    onWriteHead(res, () => this.emit("writeHead"));
    this.inited();
    return this;
  }

  /**
   * 初始化完成，由 `Context.init()` 自动调用
   * 一般用于自定义扩展 Context 时，在此方法中加上自己的祝时候完成的代码
   */
  public inited() {}

  /**
   * 获得路由信息
   */
  public get route(): RawRouteInfo {
    if (this[SYMBOL_RAW_ROUTE_INFO]) {
      return this[SYMBOL_RAW_ROUTE_INFO]!;
    }
    return { method: this.request.method || "", path: this.request.path };
  }

  /**
   * 获取Request对象
   */
  public get request(): Q {
    return this._request as Q;
  }

  /**
   * 获取Response对象
   */
  public get response(): S {
    return this._response as S;
  }

  /**
   * 转到下一个中间件
   *
   * @param err 出错信息
   */
  public next(err?: ErrorReason) {
    const next = this.nextHandleStack[this.nextHandleStack.length - 1];
    if (next) {
      next(err);
    }
  }

  /**
   * next函数堆栈入栈
   *
   * @param next 回调函数
   */
  public [SYMBOL_PUSH_NEXT_HANDLE](next: NextFunction) {
    this.nextHandleStack.push(next);
  }

  /**
   * next函数出栈
   */
  public [SYMBOL_POP_NEXT_HANDLE](): NextFunction | void {
    return this.nextHandleStack.pop();
  }

  /**
   * 注册中间件执行出错时的事件监听
   *
   * @param callback 回调函数
   */
  public onError(callback: (err: ErrorReason) => void) {
    this.on("error", callback);
  }

  /**
   * 注册响应结束时的事件监听
   *
   * @param callback 回调函数
   */
  public onFinish(callback: () => void) {
    this.on("finish", callback);
  }

  /**
   * 注册准备输出响应头时的事件监听
   *
   * @param callback 回调函数
   */
  public onWriteHead(callback: () => void) {
    this.on("writeHead", callback);
  }

  /**
   * 代理请求
   *
   * @param target
   */
  public async proxy(target: string | ProxyTarget) {
    return proxyRequest(this.request.req, this.response.res, target);
  }

  /**
   * 代理请求
   *
   * @param url 目标地址
   * @param removeHeaderNames 需要删除的原始请求头列表
   */
  public async proxyWithHeaders(url: string, removeHeaderNames: string[] = ["host"]) {
    const target = parseProxyTarget(url);
    const originalHeaders = { ...this.request.headers };
    for (const n of removeHeaderNames) {
      delete originalHeaders[n];
    }
    target.headers = originalHeaders;
    return proxyRequest(this.request.req, this.response.res, target);
  }
}

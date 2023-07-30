import { Cpc, CpcFailAsyncRespondError, CpcFailRespondError, CpcUnregisteredCommandError } from "../src/cpc.js";
import { describe, it, expect, vi, SpyInstance } from "vitest";
import {
    createConnectedFcp,
    getNoResponseCpc,
    getInitedStateConnectedCpc,
    nextMacaoTask,
} from "./__mocks__/node_process_cpc.mock.js";
import { callBackArgs, createServerFnCase } from "./__mocks__/cpc.cases.js";

it("实例创建状态检测", function () {
    const { cpcClient } = createConnectedFcp();
    expect(cpcClient.getAllCmd(), "无命令监听").toEqual({});
    expect(cpcClient.isEnded, "未结束").toBeFalsy();
    expect(cpcClient.closed, "初始状态").toBeFalsy();
});
describe("参数调用", function () {
    function createBase() {
        const fn = vi.fn((arg1) => arg1);
        const { cpcClient, cpcServer } = createConnectedFcp(undefined, { fn });
        return { cpcClient, cpcServer, fn, cmd: "fn" };
    }

    /** 测试参数传输 */
    describe.concurrent("单个参数调用与返回值", function () {
        const cases = Object.entries(callBackArgs);
        describe.each(cases)("%s", function (type, dataList) {
            it.each(dataList as any[])("%s", async function (arg) {
                const { cpcClient, fn, cmd } = createBase();
                const pms = cpcClient.call(cmd, [arg]);
                await nextMacaoTask();

                expect(fn.mock.calls[0], "参数").toEqual([arg]);
                expect(await pms, "返回值").toEqual(arg);
            });
        });
    });
    describe.concurrent("多参数写入测试", function () {
        const args = Object.entries(callBackArgs);
        it.each(args)(
            "%s",
            async function (type, arg) {
                const { cpcClient, cmd, fn } = createBase();
                await cpcClient.call(cmd, arg);

                expect(fn.mock.calls[0], type).toEqual(arg);
            },
            100
        );
    });
    /** 测试返回顺序 */
    it("连续调用", async function () {
        const { cpcClient, cmd, fn } = createBase();
        const dataList = callBackArgs.noContent;
        const pmsList: Promise<any>[] = dataList.map((args) => cpcClient.call(cmd, [args]));

        await nextMacaoTask();
        const res = await Promise.all(pmsList);
        expect(res).toEqual(dataList);
    }, 500);
    it("内联调用", async function () {
        let pms: Promise<any>;
        const { cpcClient, cpcServer } = createConnectedFcp(
            { clientFn: () => 7 },
            {
                fn(this: Cpc) {
                    pms = this.call("clientFn", [true]);
                    return 3;
                },
            }
        );
        await expect(cpcClient.call("fn")).resolves.toBe(3);
        await expect(pms!).resolves.toBe(7);
    });
});
describe("返回值", function () {
    const { cpcClient } = createConnectedFcp(undefined, createServerFnCase());

    it("异步返回", async function () {
        const arg = [true, undefined, 4];
        await expect(cpcClient.call("asyncReturnArgs", arg)).resolves.toEqual(arg);
    });

    it("未处理异常", async function () {
        await expect(cpcClient.call("cmd99")).rejects.toThrowError(CpcUnregisteredCommandError);
    });
    it("函数抛出Error对象", async function () {
        await expect(cpcClient.call("throwError")).rejects.toThrowError("yy");
    });
    it("函数抛出非Error对象", async function () {
        await expect(cpcClient.call("throwArg0", ["abc"])).rejects.toThrow("abc");
    });
    it("异步抛出Error对象", async function () {
        await expect(cpcClient.call("asyncThrowError")).rejects.toThrowError("yy");
    });
    it("异步抛出非Error对象", async function () {
        await expect(cpcClient.call("asyncThrowArg0", ["abc"])).rejects.toThrow("abc");
    });
}, 1000);

describe.concurrent("状态更改", function () {
    function expectFcpClose(cpc: Cpc, closeFn: SpyInstance) {
        expect(closeFn).toBeCalledTimes(1);
        expect(cpc.closed).toBeTruthy();
    }

    it("无等待结束状态执行end()", async function () {
        const { c, s, onErr } = getInitedStateConnectedCpc();

        c.cpc.end();
        expect(c.cpc.closed).toBeTruthy();
        await nextMacaoTask();
        expect(onErr).not.toBeCalled();
        expect(c.onEnd, "clientEnd").toBeCalledTimes(1);
        expect(c.onClose, "clientClose").toBeCalledTimes(1);

        expect(s.onEnd, "serverEnd").toBeCalledTimes(1);
        expect(s.cpc.closed).toBeTruthy();
        expect(s.onClose, "serverClose").toBeCalledTimes(1);
    });
    it("有等待结束状态执行end()-async返回值", async function () {
        const { c, s } = getInitedStateConnectedCpc();

        s.cpc.setCmd("cmd", function () {
            return new Promise((resolve) => setTimeout(resolve, 100));
        });
        const pms = c.cpc.call("cmd");
        c.cpc.end();
        await nextMacaoTask(50);
        expect(s.onEnd, "serverEnd").toBeCalledTimes(1);
        expect(c.onEnd, "clientEnd").toBeCalledTimes(1);
        expect(s.onClose, "serverNotClose").not.toBeCalled();
        expect(c.onClose, "clientNotClose").not.toBeCalled();

        expect(s.cpc.closed, "未关闭").toBeFalsy();

        await pms;
        expect(s.onEnd, "serverClose").toBeCalled();
        expect(c.onEnd, "clientClose").toBeCalled();
    });
    it("有等待结束中执行 dispose", async function () {
        const { c, s } = getInitedStateConnectedCpc();
        s.cpc.end();
        await nextMacaoTask();

        c.cpc.dispose();
        await nextMacaoTask();
        expectFcpClose(s.cpc, s.onClose);
        expectFcpClose(c.cpc, c.onClose);
    });
    it("noFin 执行 dispose", async function () {
        const { c, s } = getInitedStateConnectedCpc();

        c.cpc.dispose();
        await nextMacaoTask();
        expect(c.onEnd).toBeCalledTimes(1);

        expectFcpClose(c.cpc, c.onClose);
    });
    it("在返回前断开连接", async function () {
        const cpc = getNoResponseCpc();
        const pms = cpc.call("yyy");
        await nextMacaoTask();
        expect(cpc.isEnded).toBeFalsy();
        cpc.dispose();
        expect(cpc.closed).toBeTruthy();
        await expect(pms, "在返回前中断").rejects.toThrowError(CpcFailRespondError);
    });
    it("Promise状态在变化前断开连接", async function () {
        const { c, s } = getInitedStateConnectedCpc();

        s.cpc.setCmd("cmd", function () {
            return new Promise(function (resolve) {
                setTimeout(resolve, 500);
            });
        });
        let pms = c.cpc.call("cmd");
        await nextMacaoTask(50);
        c.cpc.dispose();
        expect(c.cpc.closed).toBeTruthy();

        await expect(pms).rejects.toThrowError(CpcFailAsyncRespondError);
    });
});

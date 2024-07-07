import { describe, test, expect, beforeEach } from "vitest";
import * as mocks from "../__mocks__/cpc_socket.mock.ts";

describe("状态更改/cpc_socket", function () {
  let mock!: ReturnType<typeof mocks.createConnectedCpc>;
  beforeEach(() => {
    mock = mocks.createConnectedCpc();
    mocks.setDuplexEvents(mock.clientSocket);
    mocks.setDuplexEvents(mock.serverSocket);
  });
  test("安全关闭", async function () {
    const { serverCpc, clientCpc, clientSocket, serverSocket } = mock;
    serverCpc.endCall();
    clientCpc.endCall();

    await Promise.all([clientCpc.onClose, serverCpc.onClose]);

    expect(clientSocket.errored).toBeFalsy();
    expect(serverSocket.errored).toBeFalsy();

    expect(clientSocket.readableEnded).toBeTruthy();
    expect(serverSocket.readableEnded).toBeTruthy();

    expect(clientSocket.closed).toBeTruthy();
    expect(serverSocket.closed).toBeTruthy();
  });
  test("外部 Duplex end()", async function () {
    const { serverCpc, clientCpc, clientSocket, serverSocket } = mock;

    clientSocket.end();

    const p1 = expect(serverCpc.onClose).rejects.toThrowError();
    const p2 = expect(clientCpc.onClose).rejects.toThrowError();

    await Promise.all([p1, p2]);
  });
  test("外部 Duplex 销毁", async function () {
    const { serverCpc, clientCpc, clientSocket, serverSocket } = mock;
    // const err = new Error("外部Duplex 销毁");
    clientSocket.destroy();

    expect(serverSocket.destroyed, "server socket 已销毁").toBeTruthy();
    expect(clientSocket.destroyed, "client socket 已销毁").toBeTruthy();

    const p1 = expect(serverCpc.onClose).rejects.toThrowError();
    const p2 = expect(clientCpc.onClose).rejects.toThrowError();

    await Promise.all([p1, p2]);
  });
}, 500);

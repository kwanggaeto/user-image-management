import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { LoginForm } from "./login-form";

function stubReload() {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { assign: vi.fn(), reload: vi.fn() },
  });
}

describe("LoginForm", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    stubReload();
  });

  test("posts category scoped credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<LoginForm category="library" />);

    await userEvent.type(screen.getByLabelText("아이디"), "admin");
    await userEvent.type(screen.getByLabelText("비밀번호"), "pass");
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/library/auth/login",
      expect.objectContaining({ method: "POST" }),
    );
  });

  test("posts remember login when the toggle is enabled", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<LoginForm category="library" />);

    await userEvent.type(screen.getByLabelText("아이디"), "admin");
    await userEvent.type(screen.getByLabelText("비밀번호"), "pass");
    await userEvent.click(screen.getByLabelText("로그인 유지"));
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({ id: "admin", password: "pass", remember: true });
  });

  test("loads and stores the category scoped saved id", async () => {
    window.localStorage.setItem("uim:library:saved-admin-id", "saved-admin");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<LoginForm category="library" />);

    expect(await screen.findByDisplayValue("saved-admin")).toBeVisible();
    expect(screen.getByLabelText("아이디 저장")).toBeChecked();
    await userEvent.clear(screen.getByLabelText("아이디"));
    await userEvent.type(screen.getByLabelText("아이디"), "next-admin");
    await userEvent.type(screen.getByLabelText("비밀번호"), "pass");
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));

    expect(window.localStorage.getItem("uim:library:saved-admin-id")).toBe(
      "next-admin",
    );
  });

  test("removes the saved id when save id is disabled", async () => {
    window.localStorage.setItem("uim:library:saved-admin-id", "saved-admin");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<LoginForm category="library" />);

    expect(await screen.findByDisplayValue("saved-admin")).toBeVisible();
    await userEvent.click(screen.getByLabelText("아이디 저장"));
    await userEvent.type(screen.getByLabelText("비밀번호"), "pass");
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));

    expect(window.localStorage.getItem("uim:library:saved-admin-id")).toBeNull();
  });
});

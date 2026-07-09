import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { LoginForm } from "./login-form";

describe("LoginForm", () => {
  test("posts category scoped credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { assign, reload: vi.fn() },
    });

    render(<LoginForm category="library" />);

    await userEvent.type(screen.getByLabelText("아이디"), "admin");
    await userEvent.type(screen.getByLabelText("비밀번호"), "pass");
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/library/auth/login",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

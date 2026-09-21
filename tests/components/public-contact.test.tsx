// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ContactForm } from "@/app/(marketing)/contact/contact-form";
const submit = vi.hoisted(() => vi.fn());
vi.mock("@/app/(marketing)/actions/submit-contact", () => ({ submitContact: submit }));
beforeEach(() => vi.clearAllMocks());
function complete() {
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Example visitor" } });
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "visitor@example.com" } });
  fireEvent.change(screen.getByLabelText("Your message"), { target: { value: "I would like to discuss assessment." } });
  fireEvent.submit(screen.getByRole("button", { name: "Send message" }).closest("form")!);
}
it("keeps answers after a submission failure", async () => {
  submit.mockRejectedValue(new Error("offline"));
  render(<ContactForm initialTopic="partner" />);
  expect(screen.getByLabelText("What would you like to discuss?")).toHaveValue("Working with Trajectas as a partner");
  complete();
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Your message")).toHaveValue("I would like to discuss assessment.");
});
it("reports success only after the server accepts the enquiry", async () => {
  let finish!: (result: { success: true }) => void;
  submit.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  render(<ContactForm />);
  complete();
  expect(screen.getByRole("button", { name: "Sending your message…" })).toBeDisabled();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  await act(async () => finish({ success: true }));
  expect(screen.getByRole("status")).toHaveTextContent("We have your message");
});

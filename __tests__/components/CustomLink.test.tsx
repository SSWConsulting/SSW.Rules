import { render, screen } from "@testing-library/react";
import { CustomLink } from "@/components/customLink";

describe("CustomLink", () => {
  describe("when href is rule URL", () => {
    it("does not open in a new tab by default", () => {
      render(<CustomLink href="/rules/do-something">click me</CustomLink>);
      expect(screen.getByRole("link")).not.toHaveAttribute("target", "_blank");
    });
    it("does not apply nofollow rel", () => {
      render(<CustomLink href="/rules/do-something">click me</CustomLink>);
      expect(screen.getByRole("link")).not.toHaveAttribute("rel", "noopener noreferrer nofollow");
    });
  });

  describe("when href is an external third-party link", () => {
    it("opens in a new tab by default", () => {
      render(<CustomLink href="https://google.com">click me</CustomLink>);
      expect(screen.getByRole("link")).toHaveAttribute("target", "_blank");
    });

    it("applies noopener noreferrer nofollow rel", () => {
      render(<CustomLink href="https://google.com">click me</CustomLink>);
      expect(screen.getByRole("link")).toHaveAttribute("rel", "noopener noreferrer nofollow");
    });
  });

  describe("When href is root relative", () => {
    it("does not apply nofollow for non rules links", () => {
      render(<CustomLink href="/company">click me</CustomLink>);
      expect(screen.getByRole("link")).not.toHaveAttribute("rel", "noopener noreferrer nofollow");
    });
  });

  describe("when href is a Tina.io link", () => {
    it("does not apply nofollow rel for tina.io", () => {
      render(<CustomLink href="https://tina.io/docs">click me</CustomLink>);
      expect(screen.getByRole("link")).toHaveAttribute("rel", "");
    });
  });
});

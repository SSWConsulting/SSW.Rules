import { render, screen } from "@testing-library/react";
import { CustomLink } from "@/components/customLink";
import Link from "next/link";

jest.mock("next/link", () => jest.fn(({prefetch, ...props}) => <a {...props} />));

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
    it("Uses prefetch links", () => {
    render(<CustomLink href="/rules/do-something">click me</CustomLink>);
      expect(Link).toHaveBeenCalledWith(
        expect.objectContaining({
          href: "/rules/do-something",
          prefetch: true,
        }),
        undefined);
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

  describe("when href is same domain", ()=> {
    it("does not prefetch for external SSW-branded sites", () => {
      render(<CustomLink href="https://ssw.com.au/people">click me</CustomLink>);
      expect(Link).not.toHaveBeenCalled();
    });
    it("does not prefetch for non-branded root urls", ()=>{
      render(<CustomLink href="https://www.ssw.com.au/company">click me</CustomLink>);
      expect(Link).not.toHaveBeenCalled();
    })
    it("prefetches for internal links", () => {
      render(<CustomLink href="https://www.ssw.com.au/rules">click me</CustomLink>);
      expect(Link).toHaveBeenCalledWith(
        expect.objectContaining({
          prefetch: true,
        }),
        undefined);
    });
  })

  describe("When href is root relative", () => {
    it("does not apply nofollow for non-rule URL", () => {
      render(<CustomLink href="/company">click me</CustomLink>);
      expect(screen.getByRole("link")).not.toHaveAttribute("rel", "noopener noreferrer nofollow");
    });
    it("not prefetched when for non-rule URL", () => {
      render(<CustomLink href="/do-something">click me</CustomLink>);
      expect(Link).not.toHaveBeenCalled();
    });
  });

  describe("when href is a Tina.io link", () => {
    it("does not apply nofollow rel for tina.io", () => {
      render(<CustomLink href="https://tina.io/docs">click me</CustomLink>);
      expect(screen.getByRole("link")).toHaveAttribute("rel", "");
    });
  });
});

beforeEach(() => {
  jest.clearAllMocks();
});
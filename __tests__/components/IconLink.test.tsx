import { render, screen } from "@testing-library/react";
import IconLink from "@/components/ui/icon-link";

describe("IconLink", () => {
  it("names an icon-only link with its title, so screen readers can read it", () => {
    render(
      <IconLink href="https://github.com/SSWConsulting" title="View rule on GitHub">
        <svg />
      </IconLink>,
    );

    expect(screen.getByRole("link", { name: "View rule on GitHub" })).toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import AuthorsCard from "@/components/AuthorsCard";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt, fill, unoptimized, ...props }: any) => <img alt={alt} {...props} />,
}));

jest.mock("tinacms/dist/react", () => ({
  tinaField: () => "authors.0.title",
}));

describe("AuthorsCard", () => {
  it("shows the silhouette placeholder for non-SSW author links", async () => {
    render(
      <AuthorsCard
        authors={[
          {
            title: "External Author",
            url: "https://example.com/people/external-author",
          },
        ]}
      />
    );

    expect(await screen.findByRole("img", { name: "External Author" })).toHaveAttribute(
      "src",
      "/uploads/ssw-employee-profile-placeholder-sketch.jpg"
    );
  });
});

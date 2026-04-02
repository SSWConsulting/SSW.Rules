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
  const expectedPlaceholderSrc = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/uploads/ssw-employee-profile-placeholder-sketch.jpg`;

  it("uses the SSW profile image endpoint for SSW author links", async () => {
    render(
      <AuthorsCard
        authors={[
          {
            title: "Adam Cogan",
            url: "https://www.ssw.com.au/people/adam-cogan",
          },
        ]}
      />
    );

    expect(await screen.findByRole("img", { name: "Adam Cogan" })).toHaveAttribute(
      "src",
      "https://raw.githubusercontent.com/SSWConsulting/SSW.People.Profiles/main/Adam-Cogan/Images/Adam-Cogan-Profile.jpg"
    );
  });

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
      expectedPlaceholderSrc
    );
  });
});

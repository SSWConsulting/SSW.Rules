import { githubAvatarUrl, profileImageUrl } from "@/lib/authorImage";

describe("profileImageUrl", () => {
  it("title-cases the slug into a profile path", () => {
    expect(profileImageUrl("https://www.ssw.com.au/people/adam-cogan")).toBe(
      "https://raw.githubusercontent.com/SSWConsulting/SSW.People.Profiles/main/Adam-Cogan/Images/Adam-Cogan-Profile.jpg"
    );
    expect(profileImageUrl("https://www.ssw.com.au/people/camilla-rosa-silva")).toContain("/Camilla-Rosa-Silva/Images/Camilla-Rosa-Silva-Profile.jpg");
  });

  it("ignores trailing slashes, query strings and fragments", () => {
    const expected = profileImageUrl("https://www.ssw.com.au/people/adam-cogan");
    expect(profileImageUrl("https://www.ssw.com.au/people/adam-cogan/")).toBe(expected);
    expect(profileImageUrl("https://www.ssw.com.au/people/adam-cogan?utm=x")).toBe(expected);
    expect(profileImageUrl("https://www.ssw.com.au/people/adam-cogan#bio")).toBe(expected);
  });

  it("only claims ssw.com.au people URLs", () => {
    expect(profileImageUrl("https://github.com/some-people/repo")).toBeNull();
    expect(profileImageUrl("https://example.com/people/adam-cogan")).toBeNull();
    expect(profileImageUrl(undefined)).toBeNull();
    expect(profileImageUrl("")).toBeNull();
  });
});

describe("githubAvatarUrl", () => {
  it("builds an avatar URL from a github profile link", () => {
    expect(githubAvatarUrl("https://github.com/octocat")).toBe("https://avatars.githubusercontent.com/octocat");
  });

  it("returns null for anything else", () => {
    expect(githubAvatarUrl("https://www.ssw.com.au/people/adam-cogan")).toBeNull();
    expect(githubAvatarUrl(undefined)).toBeNull();
  });
});

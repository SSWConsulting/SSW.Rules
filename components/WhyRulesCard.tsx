import { Card } from "@/components/ui/card";

export default function WhyRulesCard() {
  return (
    <Card title="Why All These Rules?">
      <p>
        Read about the{" "}
        <a
          className="underline"
          href="https://www.codemag.com/article/0605091"
          target="_blank"
          rel="noopener noreferrer"
        >
          History of SSW Rules
        </a>
        , published in CoDe Magazine.
      </p>
    </Card>
  );
}
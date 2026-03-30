import { tinaField } from "tinacms/dist/react";
import { Card } from "@/app/(home)/components/ui/card";

interface WhyRulesCardProps {
  data?: any;
}

export default function WhyRulesCard({ data }: WhyRulesCardProps) {
  return (
    <Card title={data?.title || "Why All These Rules?"}>
      <p data-tina-field={tinaField(data, "linkText")}>
        Read about the{" "}
        <a className="underline" href={data?.linkUrl || "https://www.codemag.com/article/0605091"} target="_blank" rel="noopener noreferrer nofollow">
          {data?.linkText || "History of SSW Rules"}
        </a>
        {data?.description || ", published in CoDe Magazine."}
      </p>
    </Card>
  );
}

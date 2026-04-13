import Link from "next/link";
import { tinaField } from "tinacms/dist/react";
import { Card } from "./ui/card";

interface QuickLinksProps {
  data?: any;
}

const QuickLinksCard = ({ data }: QuickLinksProps) => {
  const links = data?.links ?? [];
  return (
    <Card title="Quick Links">
      {links.length > 0 ? (
        <ul>
          {links.map((link: any, i: number) => (
            <li key={link.uri ?? i} data-tina-field={tinaField(link, "linkText")}>
              <Link href={link.uri} target="_blank" rel="noopener noreferrer nofollow">
                {link.linkText}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">No quick links available.</p>
      )}
    </Card>
  );
};

export default QuickLinksCard;
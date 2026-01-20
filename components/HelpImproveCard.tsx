import { Card } from "@/components/ui/card";
import { RiDoubleQuotesL, RiDoubleQuotesR } from "react-icons/ri";
import Image from "next/image";

export default function HelpImproveCard() {
  return (
    <Card title="Help Improve Our Rules">
      <blockquote>
        <RiDoubleQuotesL className="inline" />
        The SSW Rules website works just like Wikipedia. If you think
        something should be changed, hit the pencil icon and make an edit!
        Or if you are cool{" "}
        <a
          className="underline"
          href="https://twitter.com/adamcogan"
          target="_blank"
          rel="noopener noreferrer nofollow"
        >
          tweet me
        </a>
        <RiDoubleQuotesR className="inline ml-1" />
      </blockquote>
      <div className="flex flex-col gap-4 items-center mt-4">
        <Image
          src="https://adamcogan.com/wp-content/uploads/2018/07/adam-bw.jpg"
          alt=""
          className="rounded-full"
          width={96}
          height={96}
        />
        <a
          className="underline text-xl"
          href="https://www.ssw.com.au/people/adam-cogan"
          target="_blank"
          rel="noopener noreferrer"
        >
          Adam Cogan
        </a>
        <p className="font-light">Chief Software Architect at SSW</p>
      </div>
    </Card>
  );
}
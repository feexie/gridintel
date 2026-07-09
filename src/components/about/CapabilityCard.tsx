import Image from "next/image";
import Link from "next/link";

type CapabilityCardProps = {
  title: string;
  description: string;
  image: string;
  href: string;
};

export default function CapabilityCard({
  title,
  description,
  image,
  href,
}: CapabilityCardProps) {
  return (
    <Link href={href}>
      <article className="group h-full overflow-hidden rounded-3xl border border-white/5 bg-white/[0.03] transition duration-300 hover:border-cyan-400/40 hover:bg-white/[0.05]">

        <div className="relative h-44 w-full">

          <Image
            src={image}
            alt={title}
            fill
            className="object-cover transition duration-500 group-hover:scale-105"
          />

        </div>

        <div className="space-y-3 p-6">

          <h3 className="text-xl font-semibold text-white">
            {title}
          </h3>

          <p className="text-sm leading-7 text-slate-400">
            {description}
          </p>

          <div className="pt-3 text-sm font-medium text-cyan-300">
            Learn More →
          </div>

        </div>

      </article>
    </Link>
  );
}

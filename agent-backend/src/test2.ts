import { XMLParser } from "fast-xml-parser";
import fetch from "node-fetch";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";

// Step 1: Fetch and parse the sitemap
const sitemapUrl = "https://docs.everydrone.io/sitemap.xml";  // or original source with placeholder
const rawXml = await fetch(sitemapUrl).then((res) => res.text());

const parser = new XMLParser();
const sitemap = parser.parse(rawXml);

// Step 2: Extract and fix URLs
const rawUrls: string[] = sitemap.urlset.url.map((entry: any) => entry.loc);
const fixedUrls = rawUrls.map((url) =>
  url.replace("your-docusaurus-site.example.com", "docs.everydrone.io")
);
const new_fixedUrls = fixedUrls.filter((val) => val.startsWith("https://docs.everydrone.io/docs/"));
console.log(new_fixedUrls);
// Step 3: Load the docs using WebLoader
// const loader = new WebLoader(fixedUrls);
// const docs = await loader.load();
// console.log(docs);

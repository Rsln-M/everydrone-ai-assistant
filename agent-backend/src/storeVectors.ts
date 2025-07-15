import { XMLParser } from "fast-xml-parser";
import fetch from "node-fetch";
import * as dotenv from "dotenv";
import "cheerio";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import {config} from "./config"

// Step 0: Load environment variables
dotenv.config();

// Step 1: Fetch and parse the sitemap
const sitemapUrl = "https://docs.everydrone.io/sitemap.xml";  // or original source with placeholder
const rawXml = await fetch(sitemapUrl).then((res) => res.text());

const parser = new XMLParser();
const sitemap = parser.parse(rawXml);

// Step 2: Extract and fix URLs
const rawUrls: string[] = sitemap.urlset.url.map((entry: any) => entry.loc);
const urls = rawUrls
    .map((url) =>
        url.replace("your-docusaurus-site.example.com", "docs.everydrone.io"))
    .filter((val) => val.startsWith("https://docs.everydrone.io/docs/"));

// Step 3: Load the docs using WebLoader and split them
// Collect all Documents from all URLs together
const allDocs: Document<Record<string, any>>[]  = [];

for (const url of urls) {
  try {
    const cheerioLoader = new CheerioWebBaseLoader(url);
    const docs = await cheerioLoader.load();
    allDocs.push(...docs); // spread to flatten
  } catch (e) {
    console.error(`Failed to load ${url}:`, e);
  }
}

// Collect all the splits
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000, chunkOverlap: 200
});
const allSplits = await splitter.splitDocuments(allDocs);

// Step 4: Store the the splits as vectors
// Embeddings model
const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-large"
});

// Initialization
const vectorStore = await PGVectorStore.initialize(embeddings, config);

// Storing
await vectorStore.addDocuments(allSplits);

// End connection
await vectorStore.end();
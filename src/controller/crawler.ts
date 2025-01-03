import { Request, Response } from "express";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";


const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const responseSchema = z.object({
    possible_cms: z.array(z.string().refine(value => value === value.toLowerCase(), {
        message: "CMS names must be lowercase"
    })),
    analytics_tools: z.array(z.enum([
        "Adobe Analytics",
        "Microsoft Clarity",
        "Facebook Pixel",
        "Google Tag Manager (GTM)",
        "Google Analytics 4 (GA4)",
        "Google Ads (AdWords)",
        "Hotjar",
        "Crazy Egg",
        "Mixpanel",
        "Matomo",
        "Clicky",
        "Heap",
        "Piwik PRO",
        "Kissmetrics",
        "Segment"
    ])),
    cms: z.string().transform((value) => value.toLowerCase()),
    framework: z.array(z.string())
});


export const decisionAI = async (req: Request, res: Response) => {
    const { content } = req.body;
    const aiResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: `
                You’re a highly skilled web scraper and data analyst with extensive experience in developing AI-driven crawlers. Your expertise lies in identifying various content management systems, analytics tools, and website frameworks by crawling through websites and extracting relevant information. You excel at delivering precise reports that are easy to understand and act upon.
                Your task is to create an AI-driven crawler that can extract specific information from a given website. The crawler should provide insights on the following aspects:
                1. The content management system (CMS) of the website, considering all types, including Website Builders, E-commerce Platforms, Blogging Platforms, and Forum Software.
                2. Possible CMS options that the website may be using.
                3. Analytics tools employed by the website, including options like GA4, Adobe Analytics, GTM, and Hotjar.
                4. The content present on the website, summarizing key information.
                5. The framework being used, noting that this aspect is not as critical.
                Please keep in mind the importance of providing clear and structured outputs for each point to ensure that the report is comprehensive and aligns with user expectations. Also, be sure to specify any coding language or environment preferences you may have for the implementation.
                `
            },
            {
                role: "user",
                content: JSON.stringify(content),
            }
        ],
        response_format: zodResponseFormat(responseSchema, "cms_and_analytics_detection")
    });

    // Check response of AI decision from the user provided content Meta tag and script tag
    const cms = aiResponse.choices[0].message.content;

    return res.status(200).json({
        cms
    });
}
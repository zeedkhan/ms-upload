import { Request, Response } from "express";
import OpenAI from "openai";
import puppeteer from "puppeteer";
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
    cms: z.string().refine(value => value === value.toLowerCase(), {
        message: "CMS name must be lowercase"
    }),
    description: z.string(),
});


export const decisionAI = async (req: Request, res: Response) => {
    const { content } = req.body;
    const aiResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: `
                You’re a knowledgeable digital marketing specialist with extensive experience in content management systems (CMS), analytics tools. You have a deep understanding of the distinctions between CMS platforms, development frameworks and analytics tools, allowing you to easily identify and categorize them based on their functionalities and purposes.
                Your task is to detect and confirm whether the provided name refers to a content management system (CMS) and analytics tools rather than a development framework. Please analyze the provided name, analytics name carefully and provide.
                If the CMS name is recognized, please provide additional notes on its primary features and its intended use case. If the provided name does not correspond to any known CMS, state 'N/A' and include a brief explanation of why the name is not classified as a CMS.

                Noted that CMS includes Website Builders, E-commerce Platforms, Blogging Platforms, and Forum Software.

                Here are some triggers to help you identify CMS and analytics tools:
                    -Some CMS they attached their brand in the Footer section of the website.
                    -Some CMS they use their CDN to website resource.
                    -Some CMS they use their meta tags to load the website.
                    -Some analytics tools they use same domain to load the tool but different refer to their differece tool.\n
                        Like: Google Analytics, Google Tag Manager, the main domain is googletagmanager.com but you have to check the path to know which tool is being used, eg: googletagmanager.com/gtag/ is using GA4 or Google Tag while googletagmanager.com/gtm/ is using Google Tag Manager
                `
            },
            {
                role: "user",
                content: JSON.stringify(content),
            }
        ],
        response_format: zodResponseFormat(responseSchema, "cms_and_analytics_detection")
    })

    const cms = aiResponse.choices[0].message.content;
    return res.status(200).json({
        cms
    });
}

export const loaderForScreenshot = async (req: Request, res: Response) => {
    const { url } = req.body;
    try {
        const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        try {
            await page.goto(url, { waitUntil: "networkidle0", timeout: 6000 });
            const scripts = await page.evaluate(() => {
                const allScripts = Array.from(document.querySelectorAll('script'))
                    .map((script) => script.src || "")
                    .filter((script) => script !== "");

                const footerContents = Array.from(document.querySelectorAll('footer')).map((script) => script.outerHTML || "");
                const metas = Array.from(document.querySelectorAll('meta')).map((meta) => meta.outerHTML || "");
                return {
                    allScripts,
                    footerContents,
                    metas
                }
            });
            const screenshotBuffer = await page.screenshot({ encoding: 'base64' });
            await browser.close();
            return res.status(200).json({
                screenshot: screenshotBuffer,
                content: scripts
            });
        } catch (err) {
            await browser.close();
            return res.status(500).json({
                message: "An error occurred while trying to navigate to the URL",
            });
        }

    } catch (err) {
        return res.status(500).json({
            message: "An error occurred while trying to take a screenshot",
        });
    }
};



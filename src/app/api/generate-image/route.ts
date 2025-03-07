import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Create cache directory if it doesn't exist
const CACHE_DIR = path.join(process.cwd(), 'public', 'image-cache');
try {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
} catch (error) {
  console.error('Error creating cache directory:', error);
  // Continue execution even if directory creation fails
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title') || '';
  const description = searchParams.get('description') || '';
  const pollId = searchParams.get('pollId') || ''; // Get pollId parameter
  
  // Create a unique hash for this poll
  const pollHash = crypto
    .createHash('md5')
    .update(`${pollId}-${title}-${description}`)
    .digest('hex');
  
  // Define cache paths
  const cacheMetaPath = path.join(CACHE_DIR, `${pollHash}.json`);
  
  // Check if we have a cached result
  try {
    if (fs.existsSync(cacheMetaPath)) {
      try {
        const cachedData = JSON.parse(fs.readFileSync(cacheMetaPath, 'utf8'));
        return NextResponse.json({ 
          imageUrl: cachedData.imageUrl,
          cached: true 
        });
      } catch (error) {
        console.error('Error reading cache:', error);
        // Continue to generate a new image if cache read fails
      }
    }
  } catch (error) {
    console.error('Error checking cache existence:', error);
    // Continue execution if cache check fails
  }
  
  // Combine title and description to create a prompt
  const prompt = `Create a visual representation for a voting poll titled "${title}" with the description: "${description}". The image should be clear, professional, and represent the theme of the poll.`;
  
  try {
    // Check if we have the OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OPENAI_API_KEY not found, using fallback image service');
      // Use the pollId as a deterministic seed for consistent images
      const seed = pollId || encodeURIComponent(title).slice(0, 20);
      const imageUrl = `https://picsum.photos/seed/${seed}/400/300`;
      
      // Cache the result
      try {
        fs.writeFileSync(cacheMetaPath, JSON.stringify({ imageUrl }));
      } catch (error) {
        console.error('Error writing to cache:', error);
        // Continue execution even if cache write fails
      }
      
      return NextResponse.json({ imageUrl });
    }
    
    // Generate image with OpenAI
    const response = await openai.images.generate({
      model: "dall-e-2", // Use DALL-E 2 which supports 512x512
      prompt: prompt,
      n: 1,
      size: "512x512", // DALL-E 2 supports 256x256, 512x512, and 1024x1024
      response_format: "url",
    });
    
    const imageUrl = response.data[0].url;
    
    // Cache the result
    try {
      fs.writeFileSync(cacheMetaPath, JSON.stringify({ imageUrl }));
    } catch (error) {
      console.error('Error writing to cache:', error);
      // Continue execution even if cache write fails
    }
    
    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error('Error generating image:', error);
    
    // Fallback to deterministic placeholder if OpenAI fails
    const seed = pollId || encodeURIComponent(title).slice(0, 20);
    const imageUrl = `https://picsum.photos/seed/${seed}/400/300`;
    
    // Cache the fallback result too
    try {
      fs.writeFileSync(cacheMetaPath, JSON.stringify({ 
        imageUrl,
        error: 'Failed to generate image with AI, using fallback'
      }));
    } catch (error) {
      console.error('Error writing to cache:', error);
      // Continue execution even if cache write fails
    }
    
    return NextResponse.json({ 
      imageUrl,
      error: 'Failed to generate image with AI, using fallback'
    });
  }
}

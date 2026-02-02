#!/usr/bin/env node

/**
 * Convert Word document to blog post markdown
 * Extracts text and images from .docx file
 */

const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');

async function convertWordToBlog(docxPath, outputDir = './blog/posts') {
  try {
    // Extract images from the Word document first
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(docxPath);
    const zipEntries = zip.getEntries();
    
    const imagesDir = path.join(outputDir, 'images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    // Extract all images and create a mapping
    const imageMap = new Map();
    zipEntries.forEach((entry) => {
      if (entry.entryName.startsWith('word/media/')) {
        const imageName = path.basename(entry.entryName);
        const imagePath = path.join(imagesDir, imageName);
        fs.writeFileSync(imagePath, entry.getData());
        // Map the internal path to the extracted filename
        imageMap.set(entry.entryName, imageName);
        console.log(`Extracted image: ${imageName}`);
      }
    });

    // Create image converter for mammoth
    const imageConverter = (image) => {
      return image.read('base64').then((imageBuffer) => {
        // Find the image in our map
        let imageName = null;
        const imageSrc = image.src || '';
        for (const [entryName, name] of imageMap.entries()) {
          if (entryName.includes(imageSrc) || (imageSrc && imageSrc.includes(entryName))) {
            imageName = name;
            break;
          }
        }
        
        // If not found, generate a name
        if (!imageName) {
          const ext = (image.contentType && image.contentType.split('/')[1]) || 'png';
          imageName = `image-${Date.now()}.${ext}`;
          const imagePath = path.join(imagesDir, imageName);
          const buffer = Buffer.from(imageBuffer, 'base64');
          fs.writeFileSync(imagePath, buffer);
          console.log(`Extracted image (from base64): ${imageName}`);
        }
        
        return {
          src: `./images/${imageName}`
        };
      });
    };

    // Read the Word document with image conversion
    const result = await mammoth.convertToHtml(
      { path: docxPath },
      { convertImage: mammoth.images.imgElement(imageConverter) }
    );
    const html = result.value;
    const messages = result.messages;

    if (messages && messages.length > 0) {
      console.log('Conversion messages:', messages);
    }

    // Convert HTML to markdown with better paragraph handling
    let markdown = html
      // First, handle nested formatting inside paragraphs
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
      .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
      // Handle headings
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n## $1\n\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n\n')
      .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n### $1\n\n')
      // Handle images
      .replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, (match, src) => {
        return `\n![Image](${src})\n\n`;
      })
      // Handle paragraphs - keep their content and add double newlines
      .replace(/<p[^>]*>(.*?)<\/p>/gis, '$1\n\n')
      // Handle line breaks
      .replace(/<br\s*\/?>/gi, '\n')
      // Remove remaining HTML tags
      .replace(/<[^>]+>/g, '')
      // Clean up entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Clean up formatting artifacts
      .replace(/\*\*\s*\*\*/g, '') // Remove empty bold markers
      .replace(/\*\s*\*/g, '') // Remove empty italic markers
      // Normalize whitespace
      .replace(/[ \t]+/g, ' ') // Multiple spaces to single space
      .replace(/^\s+/gm, '') // Remove leading whitespace from lines
      .replace(/\s+$/gm, '') // Remove trailing whitespace from lines
      .replace(/\n{3,}/g, '\n\n') // Normalize multiple newlines to double
      .trim();

    // Generate filename from document name
    const docName = path.basename(docxPath, '.docx');
    const slug = docName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const date = new Date().toISOString().split('T')[0];
    const filename = `${date}-${slug}.md`;

    // Create frontmatter
    const title = docName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const frontmatter = `---
title: ${title}
date: '${date}'
slug: ${slug}
excerpt: ''
readTime: ${Math.ceil(markdown.split(/\s+/).length / 200)}
tags: []
aiSummary:
  summary: ''
  quotes: []
---
`;

    // Post-process markdown to fix common issues
    // Split into lines for processing
    let lines = markdown.split('\n');
    let processedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      
      // Skip empty lines
      if (!line) {
        processedLines.push('');
        continue;
      }
      
      // Detect lines that look like headings but aren't marked as such
      // - Short lines (< 60 chars) that don't end with punctuation
      // - Or lines that are all caps/title case and short
      const isShortLine = line.length < 60;
      const endsWithoutPunctuation = !/[.!?,;:]$/.test(line);
      const looksLikeTitle = /^[A-Z][^.!?]*$/.test(line) && !line.includes('  ');
      const nextLineExists = i + 1 < lines.length;
      const nextLineIsContent = nextLineExists && lines[i + 1].trim().length > 60;
      
      if (isShortLine && endsWithoutPunctuation && looksLikeTitle && nextLineIsContent && !line.startsWith('#')) {
        // This looks like a heading, convert it
        processedLines.push('## ' + line);
        processedLines.push('');
      } else {
        processedLines.push(line);
      }
    }
    
    // Rejoin and clean up
    markdown = processedLines.join('\n')
      .replace(/\n{3,}/g, '\n\n') // Normalize multiple newlines
      .trim();
    
    const fullContent = frontmatter + '\n' + markdown;

    // Write the markdown file
    const outputPath = path.join(outputDir, filename);
    fs.writeFileSync(outputPath, fullContent, 'utf8');

    console.log(`✅ Blog post created: ${outputPath}`);
    console.log(`📝 Title: ${title}`);
    console.log(`🔗 Slug: ${slug}`);
    console.log(`📸 Images extracted to: ${imagesDir}`);

    return outputPath;
  } catch (error) {
    console.error('Error converting Word document:', error);
    throw error;
  }
}

// Main execution
const docxPath = process.argv[2] || './Blog Post Word Docs/Positive mindset.docx';
const outputDir = process.argv[3] || './blog/posts';

if (!fs.existsSync(docxPath)) {
  console.error(`Error: File not found: ${docxPath}`);
  process.exit(1);
}

convertWordToBlog(docxPath, outputDir)
  .then(() => {
    console.log('✅ Conversion complete!');
  })
  .catch((error) => {
    console.error('❌ Conversion failed:', error);
    process.exit(1);
  });


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

    // Convert HTML to markdown (simple conversion)
    let markdown = html
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, (match, src) => {
        return `![Image](${src})\n\n`;
      })
      .replace(/<[^>]+>/g, '') // Remove remaining HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\*\* \*\*/g, '') // Remove empty bold markers
      .replace(/\n{3,}/g, '\n\n') // Normalize multiple newlines
      .replace(/^\s+/gm, '') // Remove leading whitespace from each line
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


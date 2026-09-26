import { readFileSync, writeFileSync } from 'fs';

// Fix ChatArea.jsx
let chatArea = readFileSync('src/components/Chat/ChatArea.jsx', 'utf8');

// 1. Add ReactDOM import
chatArea = chatArea.replace(
  "import React, { useRef, useEffect, useState } from 'react';",
  "import React, { useRef, useEffect, useState } from 'react';\nimport ReactDOM from 'react-dom';"
);

// 2. Replace the old dropdown with portal version
const oldDropdownOpen = `            {showOptionsMenu && (
              <div
                style={{
                  position: 'fixed',
                  top: optionsMenuPos.top,
                  right: optionsMenuPos.right,
                  backgroundColor: 'rgba(18, 24, 36, 0.96)',
                  backdropFilter: 'blur(30px) saturate(190%)',
                  WebkitBackdropFilter: 'blur(30px) saturate(190%)',
                  borderRadius: 16,
                  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.75), 0 0 1px 1px rgba(255, 255, 255, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  width: 190,
                  zIndex: 999999,
                  overflow: 'hidden'
                }}
              >`;

const newDropdownOpen = `            {showOptionsMenu && ReactDOM.createPortal(
              <div
                style={{
                  position: 'fixed',
                  top: optionsMenuPos.top,
                  right: optionsMenuPos.right,
                  backgroundColor: 'rgba(18, 24, 36, 0.97)',
                  backdropFilter: 'blur(30px) saturate(190%)',
                  WebkitBackdropFilter: 'blur(30px) saturate(190%)',
                  borderRadius: 16,
                  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.85), 0 0 1px 1px rgba(255, 255, 255, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  width: 200,
                  zIndex: 2147483647,
                  overflow: 'hidden'
                }}
              >`;

// 3. Replace closing )}  with portal closing
const oldDropdownClose = `              </div>
            )}`;
const newDropdownClose = `              </div>,
              document.body
            )}`;

if (!chatArea.includes(oldDropdownOpen.replace(/\r\n/g, '\n'))) {
  // Try CRLF
  const crlf = oldDropdownOpen.replace(/\n/g, '\r\n');
  if (chatArea.includes(crlf)) {
    chatArea = chatArea.replace(crlf, newDropdownOpen.replace(/\n/g, '\r\n'));
    console.log('Replaced dropdown open (CRLF)');
  } else {
    console.log('ERROR: Could not find dropdown open block');
    process.exit(1);
  }
} else {
  chatArea = chatArea.replace(oldDropdownOpen.replace(/\r\n/g, '\n'), newDropdownOpen.replace(/\r\n/g, '\n'));
  console.log('Replaced dropdown open (LF)');
}

// Find and replace the closing - it appears twice potentially, get the right one
// The one after the portal's </div>
const closeVariantCRLF = oldDropdownClose.replace(/\n/g, '\r\n');
const newCloseCRLF = newDropdownClose.replace(/\n/g, '\r\n');

// Count occurrences
const count = (chatArea.match(new RegExp(closeVariantCRLF.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
console.log(`Found ${count} occurrences of dropdown close`);

if (count === 1) {
  chatArea = chatArea.replace(closeVariantCRLF, newCloseCRLF);
  console.log('Replaced dropdown close');
} else if (count > 1) {
  // Replace the first one after the dropdown open
  const openIdx = chatArea.indexOf('ReactDOM.createPortal(');
  const closeIdx = chatArea.indexOf(closeVariantCRLF, openIdx);
  if (closeIdx !== -1) {
    chatArea = chatArea.substring(0, closeIdx) + newCloseCRLF + chatArea.substring(closeIdx + closeVariantCRLF.length);
    console.log('Replaced first dropdown close after portal open');
  }
}

writeFileSync('src/components/Chat/ChatArea.jsx', chatArea, 'utf8');
console.log('ChatArea.jsx updated successfully');

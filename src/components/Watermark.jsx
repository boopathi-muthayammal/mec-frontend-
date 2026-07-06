import React from 'react';

function Watermark({ text }) {
  if (!text) return null;
  
  const encodedText = encodeURIComponent(text);
  const svgDataUri = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200' viewBox='0 0 300 200'%3E%3Ctext x='10' y='100' fill='%23888888' font-size='20' font-family='sans-serif' transform='rotate(-30 10 100)' font-weight='bold' opacity='0.4'%3E${encodedText}%3C/text%3E%3C/svg%3E`;
  
  return (
    <div 
      className="global-watermark" 
      style={{ backgroundImage: `url("${svgDataUri}")` }}
    ></div>
  );
}

export default Watermark;

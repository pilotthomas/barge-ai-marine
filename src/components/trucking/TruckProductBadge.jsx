import React from "react";

export default function TruckProductBadge({ productName, brand, className = "" }) {
  const getProductColor = (product, brandName) => {
    const productUpper = (product || '').toUpperCase();
    const brandUpper = (brandName || '').toUpperCase();
    
    // Based on Excel conditional formatting - prioritize brand for lubricants
    if (brandUpper.includes('CASTROL')) {
      return 'bg-green-800 text-white';
    }
    if (brandUpper.includes('CHEVRON')) {
      return 'bg-cyan-400 text-gray-900';
    }
    if (brandUpper.includes('SHELL')) {
      return 'bg-yellow-300 text-gray-900';
    }
    if (brandUpper.includes('LENOL')) {
      return 'bg-red-600 text-white';
    }
    if (brandUpper.includes('TOTAL')) {
      return 'bg-purple-300 text-gray-900';
    }
    
    // Product-based colors for non-branded items
    if (productUpper.includes('PTL BLENDING') || productUpper.includes('BLENDING')) {
      return 'bg-gray-900 text-white';
    }
    if (productUpper.includes('INVENTORY') || productUpper.includes('PICKUP')) {
      return 'bg-gray-400 text-white';
    }
    if (productUpper.includes('RD99') || productUpper.includes('RENEWABLE')) {
      return 'bg-green-500 text-white';
    }
    if (productUpper.includes('CARB')) {
      return 'bg-gray-300 text-gray-900';
    }
    if (productUpper.includes('GASOLINE')) {
      return 'bg-white text-gray-900 border-2 border-gray-400';
    }
    if (productUpper.includes('ULS') || productUpper.includes('DIESEL')) {
      return 'bg-slate-100 text-gray-900';
    }
    
    return 'bg-slate-100 text-gray-900';
  };

  const colorClass = getProductColor(productName, brand);
  const displayText = brand ? `${brand} - ${productName}` : productName;

  return (
    <div className={`px-3 py-1 rounded-md font-semibold text-sm ${colorClass} ${className}`}>
      {displayText}
    </div>
  );
}
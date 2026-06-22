'use client';

import React, { useEffect, useState } from 'react';

interface PetalProps {
  id: number;
  left: string;
  size: string;
  delay: string;
  duration: string;
}

export default function Petals() {
  const [petals, setPetals] = useState<PetalProps[]>([]);

  useEffect(() => {
    // Generate random petals
    const newPetals: PetalProps[] = Array.from({ length: 18 }).map((_, i) => {
      const left = Math.random() * 100 + '%';
      const size = Math.random() * 12 + 8 + 'px'; // 8px to 20px
      const delay = Math.random() * 10 + 's';
      const duration = Math.random() * 8 + 8 + 's'; // 8s to 16s
      return { id: i, left, size, delay, duration };
    });
    setPetals(newPetals);
  }, []);

  return (
    <div className="petals-container">
      {petals.map((petal) => (
        <div
          key={petal.id}
          className="petal"
          style={{
            left: petal.left,
            width: petal.size,
            height: petal.size,
            animationDelay: petal.delay,
            animationDuration: petal.duration,
          }}
        />
      ))}
    </div>
  );
}

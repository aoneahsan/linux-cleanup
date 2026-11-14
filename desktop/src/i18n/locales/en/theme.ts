/** The one theme control. */
export default {
  title: 'Appearance',
  axes: {
    theme: { legend: 'Appearance', system: 'Follow Linux', light: 'Light', dark: 'Dark' },
    palette: { legend: 'Colour treatment', survey: 'Survey Chartreuse', coral: 'Coral', violet: 'Violet' },
    radius: { legend: 'Corners', none: 'Square', small: 'Small', medium: 'Medium', large: 'Large' },
    density: { legend: 'Density', compact: 'Compact', comfortable: 'Comfortable', spacious: 'Spacious' },
    typeScale: { legend: 'Text size', small: 'Small', medium: 'Medium', large: 'Large' },
    motion: { legend: 'Motion', system: 'Follow Linux', full: 'Full', reduced: 'Reduced' },
    sound: { legend: 'Sound', off: 'Off', on: 'Soft ticks' },
  },
  platePreview: '05',
} as const;

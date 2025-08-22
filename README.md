# MarFi Dashboard

A modern financial data analysis dashboard built with React, TypeScript, and TailwindCSS featuring glassmorphism design, advanced filtering, and interactive data visualization.

## Features

- **Modern Glassmorphism UI**: Beautiful glass-effect design with backdrop blur and transparency
- **Advanced Filtering System**:
  - Multi-select dropdown filters with overflow management
  - Date picker filters for date columns (automatically detected)
  - Column-specific filters with search functionality
  - Smart pill display with "+N more" indicators
- **Interactive Data Grid**:
  - Sortable columns (ascending/descending)
  - Comprehensive pagination system
  - Real-time filtering and search
- **Responsive Design**: Works seamlessly across desktop, tablet, and mobile devices
- **Data Management**: CSV data parsing and import functionality

## Project Structure

```
marfi-dashboard/
├── client/
│   ├── pages/
│   │   └── Index.tsx          # Main dashboard component
│   └── global.css             # Global styles and glassmorphism effects
├── package.json               # Dependencies and scripts
├── vite.config.ts            # Vite configuration
├── tailwind.config.ts        # TailwindCSS configuration
└── tsconfig.json             # TypeScript configuration
```

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn package manager

## Installation & Setup

1. **Clone or download the project files**

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Start the development server**:

   ```bash
   npm run dev
   ```

4. **Open your browser** and navigate to `http://localhost:5173`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run test` - Run tests
- `npm run typecheck` - Run TypeScript type checking

## Usage

### Dashboard Features

1. **Filter Controls**: Use the collapsible filter panel at the top to:

   - Select publish type (Forecast/Actuals/Plan)
   - Choose fiscal year and quarters
   - Filter by functional groups
   - Toggle allocation settings

2. **Data Grid**:

   - Click column headers to sort data
   - Use filter icons in column headers for column-specific filtering
   - Navigate through pages using pagination controls
   - Adjust rows per page as needed

3. **Date Filtering**: Date columns automatically show date picker filters instead of checkbox lists

4. **Pill Overflow**: When multiple selections are made, pills show "+N more" to indicate additional selections

### Data Import

Click the "Import" or "Run" buttons to load the sample data. The application includes sample project data with:

- Project information
- Budget and spend data
- Team assignments
- Regional data
- Status tracking

## Customization

### Adding New Data

Replace the `mockCsvData` in `client/pages/Index.tsx` with your own CSV data or modify the data loading functions to connect to your API.

### Styling

The application uses TailwindCSS with custom glassmorphism effects defined in `client/global.css`. Key style classes:

- `.glass-card` - Main glassmorphism container
- `.dropdown-panel` - Filter dropdown styling
- `.pill` - Selection pill styling

### Filter Configuration

Modify the filter options in the state initialization section of `Index.tsx`:

- `publishType.options` - Publish type options
- `fiscalYear.options` - Available fiscal years and quarters
- `functionalGroup.options` - Functional group options

## Technical Details

### Built With

- **React 18** - UI framework
- **TypeScript** - Type safety
- **TailwindCSS** - Styling and responsive design
- **Vite** - Build tool and dev server
- **Lucide React** - Icon library

### Key Features Implementation

- **Glassmorphism**: Custom CSS with backdrop-blur and transparent backgrounds
- **Responsive Grid**: CSS Grid with adaptive column counts
- **State Management**: React hooks for complex filter state
- **Performance**: Memoized data processing and efficient re-renders
- **Accessibility**: Keyboard navigation and screen reader support

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Production Deployment

1. Build the application:

   ```bash
   npm run build
   ```

2. The built files will be in the `dist/` directory

3. Serve the static files using any web server or deploy to:
   - Vercel
   - Netlify
   - AWS S3 + CloudFront
   - GitHub Pages

## Troubleshooting

### Common Issues

1. **Dependencies not installing**: Delete `node_modules` and `package-lock.json`, then run `npm install`

2. **TypeScript errors**: Run `npm run typecheck` to see detailed type errors

3. **Build failures**: Ensure all dependencies are installed and Node.js version is compatible

### Performance Tips

- Use `npm run build` for optimized production builds
- Enable gzip compression on your server
- Consider implementing lazy loading for large datasets

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is private and proprietary.

---

**MarFi Dashboard** - Built with ❤️ using modern web technologies
# reportbuilder

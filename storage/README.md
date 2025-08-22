# Storage Directory

This directory contains saved dashboard views as JSON files.

## Structure

- `saved-views/` - Contains individual view files named as `view-{id}.json`

## File Format

Each saved view file contains:
- `id` - Unique identifier
- `name` - User-provided name for the view
- `description` - Optional description
- `savedAt` - Timestamp when the view was saved
- `dashboardState` - Complete dashboard configuration including:
  - `cards` - Chart configurations
  - `hideControls` - Control visibility state
  - `importedData` - Dataset used for the view
- `chartCount` - Number of charts in the view
- `chartTypes` - Array of chart types used

## Access

Views are accessed through the API endpoints:
- `GET /api/storage/get-views` - Retrieve all saved views
- `POST /api/storage/save-view` - Save a new view
- `DELETE /api/storage/delete-view/:id` - Delete a specific view
- `DELETE /api/storage/clear-views` - Clear all saved views
- `GET /api/storage/storage-info` - Get storage statistics

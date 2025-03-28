# File Size Analyzer

A simple tool to analyze and visualize directory sizes on your computer.

## Setup

1. Make sure you have Node.js installed (download from https://nodejs.org)
2. Download this project with
   ```
   git clone https://github.com/MarryisHotter/filesizeanalyzer.git
   ```
3. Open a terminal/command prompt as Administrator and navigate to the project folder:
   ```
   cd path/to/filesizeanalyzer
   ```
   or open the project folder in Windows Explorer, click in the address bar, type "cmd" and press Enter

5. Install dependencies (this may take a minute):
   ```
   npm install
   ```

6. Start the application:
   ```
   npm run start
   ```

7. Open your browser and go to: http://localhost:5341

## Usage

1. Enter a directory path (e.g., C:\Users\YourName\Documents or C:\ for everything)
2. Click "Scan Directory"
3. View the visualization of file and directory sizes

## Notes

- Clicking on the "more files" button in the visualisation displays the next 25 biggest files
- Some system folders and files might be inaccessible
- Large directories may take a moment to scan
- The visualization shows the 25 largest files by default
- There is the command "npm run cleanup" to clear dependencies and generated files
- Specific unicode characters are currently not supported, files with those in the name will be skipped

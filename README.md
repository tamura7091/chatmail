# ChatMail

ChatMail is an alternative Gmail client interface built with React that focuses on conversations with individual people rather than traditional email threads. The application presents your Gmail messages in a chat-like interface similar to popular messaging applications.

## Core Features

- Fetches emails from your Gmail account via the Gmail API
- Groups emails into conversations based on the person you're interacting with
- Presents a chat-like interface for viewing email conversations
- Securely connects to Gmail using Google OAuth 2.0

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- A Google Cloud Platform account (only needed for real API usage)
- Gmail API credentials (only needed for real API usage)

### Quick Start with Mock Data

For testing and development purposes, you can run the application with mock data without connecting to the Gmail API:

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/chatmail.git
   cd chatmail
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Ensure `.env.local` has the mock data flag set to true:
   ```
   NEXT_PUBLIC_USE_MOCK_DATA=true
   ```

4. Start the application:
   ```
   npm run dev
   ```
   or
   ```
   npm start
   ```

5. Open [http://localhost:3000](http://localhost:3000) to see the application with sample conversations.

### Setting Up with Real Gmail API (Optional)

If you want to use your real Gmail account:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable the Gmail API for your project
4. Create OAuth 2.0 credentials
   - Set Authorized JavaScript origins to `http://localhost:3000`
   - Set Authorized redirect URIs to `http://localhost:3000`
5. Note your Client ID and API Key

6. Edit `.env.local` to use real API:
   ```
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   NEXT_PUBLIC_GOOGLE_API_KEY=your-api-key
   NEXT_PUBLIC_USE_MOCK_DATA=false
   ```

7. Start the development server:
   ```
   npm run dev
   ```

## Required Gmail API Permissions

ChatMail requests the following permissions from Google (when using real API):
- `gmail.readonly`: To read your Gmail messages
- `userinfo.email`: To get your email address
- `userinfo.profile`: To get your name and profile picture

## Technical Overview

- **Frontend**: React with Next.js
- **Styling**: Tailwind CSS
- **Authentication**: Google OAuth 2.0
- **API**: Google Gmail API or Mock Data for development

## Project Structure

- `/app`: Next.js app router pages
- `/src/components`: React components
- `/src/context`: Context providers for state management
- `/src/types`: TypeScript type definitions
- `/src/utils`: Utility functions, including Gmail API integration
- `/src/mocks`: Mock data for development and testing

## Commands

- `npm run dev` - Start the development server
- `npm run build` - Build the application for production
- `npm start` - Start the production server
- `npm run lint` - Run ESLint to check code quality

## Security Considerations

- When using the real API, the application only requests read-only access to your Gmail account
- No email data is stored on any server
- All processing happens in your browser
- OAuth tokens are stored in your browser and not shared with any third parties

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

import { createTheme } from '@mui/material/styles';

const lightTheme = createTheme({
  typography: {
    fontFamily: [
      'Poppins',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
      '"Apple Color Emoji"',
      '"Segoe UI Emoji"',
      '"Segoe UI Symbol"',
    ].join(','),
    h1: {
      fontSize: "48px",
      fontWeight: 600,
      background: "linear-gradient(90.85deg, #020024 0.31%, #790977 46.53%, #00D4FF 107.22%)",
      backgroundClip: "text",
      WebkitTextFillColor: "transparent",
      textAlign: "center",
    },
    h2: {
      fontSize: "36px",
      textAlign: "center",
    }
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          background: "#E8E8E8",
          boxShadow: "none",
          borderRadius: "15px",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          background: "#790977",
          borderRadius: "15px",
          boxShadow: "0px 4px 4px rgba(0, 0, 0, 0.1)",
          color: "white",
          textTransform: "none",
        },
      },
    },
  },
  palette: {
    mode: 'light',
  },
});

export default lightTheme;

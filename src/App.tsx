import "./App.css";
import Layout from "./componets/Layout";
import { ToastProvider } from "./componets/Toast";
import ToastContainer from "./componets/Toast/ToastContainer";

function App() {
  return (
    <ToastProvider>
      <div className="h-full w-full">
        <Layout />
        <ToastContainer />
      </div>
    </ToastProvider>
  );
}

export default App;

import { useState, useEffect, useCallback, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { base44 } from "@/api/base44Client";
import { getGoogleSheetsConnectionStatus } from "@/lib/server-fns";

const CONNECTOR_ID = "6ae79347cd3d8383bd8d098a";
export default function useGoogleSheetsConnection() {
  const check = useServerFn(getGoogleSheetsConnectionStatus);
  const [user, setUser] = useState(null);
  const [connected, setConnected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const mounted = useRef(false);
  const lock = useRef(false);
  const timer = useRef(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const authed = await base44.auth.isAuthenticated();
      if (!mounted.current) return;
      if (!authed) { setUser(null); setConnected(null); setError(null); return; }
      const me = await base44.auth.me();
      if (!mounted.current) return;
      setUser(me);
      const response = await check();
      if (mounted.current) { setConnected(Boolean(response?.connected)); setError(null); }
    } catch (cause) {
      if (mounted.current) setError(cause);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [check]);
  useEffect(() => {
    mounted.current = true;
    refresh();
    return () => { mounted.current = false; clearInterval(timer.current); };
  }, [refresh]);
  const connect = async () => {
    if (lock.current || !user) return;
    lock.current = true; setBusy(true); setError(null);
    const popup = window.open("", "_blank", "popup,width=600,height=720");
    try {
      if (!popup) throw new Error("popup_blocked");
      popup.opener = null;
      const url = await base44.connectors.connectAppUser(CONNECTOR_ID);
      popup.location.replace(url);
      timer.current = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer.current); lock.current = false;
          if (mounted.current) { setBusy(false); refresh(); }
        }
      }, 500);
    } catch (cause) {
      popup?.close(); lock.current = false;
      if (mounted.current) { setBusy(false); setError(cause); }
    }
  };
  const disconnect = async () => {
    if (lock.current || !user) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      await base44.connectors.disconnectAppUser(CONNECTOR_ID);
      if (mounted.current) setConnected(false);
    } catch (cause) { if (mounted.current) setError(cause); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  return { user, connected, loading, busy, error, refresh, connect, disconnect, setConnected };
}
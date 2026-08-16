'use client'

import { useEffect, useCallback } from 'react'
import { emergencyClient, type EmergencyClient, type AlertOptions } from '@/lib/emergencyClient'
import type { ServiceType, Severity } from '@/lib/emergencyStore'

export function useEmergencyClient(client: EmergencyClient = emergencyClient) {
  useEffect(() => {
    client.start()
    return () => client.stop()
  }, [client])

  const sendAlert = useCallback((severity: Severity, message: string, opts?: AlertOptions) => client.sendAlert(severity, message, opts), [client])
  const sendAlertTo = useCallback((type: ServiceType, severity: Severity, message: string, opts?: AlertOptions) => client.sendAlertTo(type, severity, message, opts), [client])
  const ackIncident = useCallback((type: ServiceType, incidentId: string, eta?: number) => client.ackIncident(type, incidentId, eta), [client])
  const dispatchIncident = useCallback((type: ServiceType, incidentId: string, action: 'DISPATCH' | 'RESOLVED', note?: string) => client.dispatchIncident(type, incidentId, action, note), [client])
  const sendChat = useCallback((text: string) => client.sendChat(text), [client])
  const sendChatTo = useCallback((type: ServiceType, text: string) => client.sendChatTo(type, text), [client])
  const sendIncidentChat = useCallback((incidentId: string, text: string) => client.sendIncidentChat(incidentId, text), [client])
  const sendNote = useCallback((incidentId: string, text: string) => client.sendNote(incidentId, text), [client])
  const sendPhoto = useCallback((incidentId: string, photo: string, opts?: { caption?: string; role?: string }) => client.sendPhoto(incidentId, photo, opts), [client])
  const capturePhoto = useCallback((opts: { cameraAllowed: boolean; severity: Severity; deviceName: string }) => client.capturePhoto(opts), [client])
  const cancelAlert = useCallback((incidentId: string) => client.cancelAlert(incidentId), [client])
  const reportSafety = useCallback((incidentId: string, safe: boolean) => client.reportSafety(incidentId, safe), [client])
  const moveTo = useCallback((lat: number, lng: number) => client.moveTo(lat, lng), [client])
  const reconnectAll = useCallback(() => client.reconnectAll(), [client])
  const requestLocation = useCallback(() => client.requestLocation(), [client])
  const stopLiveTracking = useCallback(() => client.stopLiveTracking(), [client])
  const setDegraded = useCallback((on: boolean) => client.setDegraded(on), [client])
  const simulateAlert = useCallback((type: ServiceType) => client.simulateAlert(type), [client])
  const replayIncident = useCallback((incidentId: string) => client.replayIncident(incidentId), [client])
  const setLinked = useCallback((v: boolean) => client.setLinked(v), [client])

  return { sendAlert, sendAlertTo, ackIncident, dispatchIncident, sendChat, sendChatTo, sendIncidentChat, sendNote, sendPhoto, capturePhoto, cancelAlert, reportSafety, moveTo, reconnectAll, requestLocation, stopLiveTracking, setDegraded, simulateAlert, replayIncident, setLinked }
}
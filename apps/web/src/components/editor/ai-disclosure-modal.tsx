"use client";

import { useEffect, useState } from "react";
import { Button, Modal, useOverlayState } from "@heroui/react";

const STORAGE_KEY = "noteey.ai.disclosureAcknowledged";

export function AidisclosureModal() {
  const [visible, setVisible] = useState(false);
  const state = useOverlayState();

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      if (window.localStorage.getItem(STORAGE_KEY) === "true") return;
      setVisible(true);
      state.open();
    } catch {
      setVisible(true);
      state.open();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="sm">
          <Modal.Dialog className="max-w-sm rounded-xl p-6">
            <Modal.Header>
              <Modal.Heading>AI editing notice</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p className="text-sm text-muted-foreground">
                When you use Inline AI Editing, the selected note content you
                send may be processed by the configured AI provider outside
                Noteey.
              </p>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="primary"
                onPress={() => {
                  try {
                    window.localStorage.setItem(STORAGE_KEY, "true");
                  } catch {
                    // ignore storage failures
                  }
                  state.close();
                  setVisible(false);
                }}
              >
                Continue
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

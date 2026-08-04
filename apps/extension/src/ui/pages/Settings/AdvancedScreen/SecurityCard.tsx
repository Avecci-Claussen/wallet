import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Card, Column, Icon, Row, Text } from '@/ui/components';
import { fontSizes } from '@/ui/theme/font';
import { getLockTimeInfo } from '@unisat/wallet-shared';
import { useAutoLockTimeId, useChain, useCurrentKeyring, useI18n, useWallet } from '@unisat/wallet-state';

export function SecurityCard() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const wallet = useWallet();
  const autoLockTimeId = useAutoLockTimeId();
  const lockTimeConfig = getLockTimeInfo(autoLockTimeId, t);
  const currentKeyring = useCurrentKeyring();
  const chain = useChain();
  const [canExport, setCanExport] = useState(false);

  // BIP-380 descriptors are Bitcoin-only (not Fractal)
  const descriptorsAvailable = !chain?.isFractal;

  useEffect(() => {
    let cancelled = false;
    if (!descriptorsAvailable) {
      setCanExport(false);
      return;
    }
    wallet
      .canExportAccountDescriptor()
      .then((ok: boolean) => {
        if (!cancelled) setCanExport(Boolean(ok));
      })
      .catch(() => {
        if (!cancelled) setCanExport(false);
      });
    return () => {
      cancelled = true;
    };
  }, [wallet, descriptorsAvailable, currentKeyring?.key, currentKeyring?.type]);

  return (
    <Card style={{ borderRadius: 10 }}>
      <Column fullX>
        <Row
          justifyBetween
          style={{
            cursor: 'pointer',
            marginBottom: 16
          }}
          onClick={() => navigate('/settings/password')}>
          <Text text={t('change_password')} size="sm" />
          <Icon icon="right" size={fontSizes.lg} color="textDim" />
        </Row>

        <Row
          justifyBetween
          style={{
            cursor: 'pointer',
            marginBottom: descriptorsAvailable ? 16 : 0
          }}
          onClick={() => navigate('/settings/lock-time')}>
          <Text text={t('automatic_lock_time')} size="sm" />

          <Row itemsCenter>
            <Text text={lockTimeConfig.label} color="gold" size="sm" />
            <Icon icon="right" size={fontSizes.lg} color="textDim" />
          </Row>
        </Row>

        {canExport ? (
          <Row
            justifyBetween
            style={{
              cursor: 'pointer',
              marginBottom: 16
            }}
            onClick={() => navigate('/settings/export-descriptor')}>
            <Text text={t('export_descriptor_xpub')} size="sm" />
            <Icon icon="right" size={fontSizes.lg} color="textDim" />
          </Row>
        ) : null}

        {descriptorsAvailable ? (
          <Row
            justifyBetween
            style={{
              cursor: 'pointer'
            }}
            onClick={() => navigate('/settings/import-descriptor')}>
            <Text text={t('import_descriptor')} size="sm" />
            <Icon icon="right" size={fontSizes.lg} color="textDim" />
          </Row>
        ) : null}
      </Column>
    </Card>
  );
}

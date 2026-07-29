import BigNumber from 'bignumber.js';

import { DecodedPsbt, DecodedPsbtInput, Inscription } from '@unisat/wallet-shared';
import { useI18n } from '@unisat/wallet-state';

import { Column } from '../Column';
import InscriptionPreview from '../InscriptionPreview';
import { Row } from '../Row';
import { Text } from '../Text';
import { RiskDetailPopover, riskAssetCardStyle } from './RiskDetailPopover';

function getInputAssetsCount(input: DecodedPsbtInput) {
  return input.inscriptions.length + input.runes.length + input.alkanes.length;
}

function getInscription(inscriptions: Record<string, Inscription>, inscription: Inscription) {
  return inscriptions[inscription.inscriptionId] || inscription;
}

export const MultipleAssetsList = ({ decodedPsbt, onClose }: { decodedPsbt: DecodedPsbt; onClose: () => void }) => {
  const { t } = useI18n();
  const mixedInputs = decodedPsbt.inputInfos.filter((input) => getInputAssetsCount(input) > 1);

  return (
    <RiskDetailPopover title={t('multiple_assets_risk_title')} onClose={onClose}>
      {mixedInputs.map((input) => {
        const inscriptions = input.inscriptions
          .map((inscription) => getInscription(decodedPsbt.inscriptions, inscription))
          .filter((inscription) => !inscription.brc20);
        const brc20Inscriptions = input.inscriptions
          .map((inscription) => getInscription(decodedPsbt.inscriptions, inscription))
          .filter((inscription) => inscription.brc20);

        return (
          <Column key={`${input.txid}:${input.vout}`} fullX gap="sm">
            <Text
              text={`${input.txid.slice(0, 8)}...${input.txid.slice(-8)}:${input.vout}`}
              preset="sub"
              color="textDim"
            />

            {inscriptions.length > 0 ? (
              <Column fullX gap="md" mt="md">
                <Text text={`${t('inscriptions')}:`} preset="sub" />
                <Row fullX px="md" style={riskAssetCardStyle} overflowX>
                  {inscriptions.map((inscription) => (
                    <InscriptionPreview
                      key={inscription.inscriptionId}
                      data={inscription}
                      preset="small"
                      infoBgColor="#292929"
                    />
                  ))}
                </Row>
              </Column>
            ) : null}

            {brc20Inscriptions.length > 0 ? (
              <Column fullX gap="sm" mt="md">
                <Text text={`${t('brc20')}:`} preset="sub" />
                {brc20Inscriptions.map((inscription) => (
                  <Row
                    key={inscription.inscriptionId}
                    justifyBetween
                    fullX
                    px="md"
                    py="xl"
                    style={riskAssetCardStyle}
                    mt="md">
                    <Text text={inscription.brc20?.tick || ''} />
                    <Text text={inscription.brc20?.amt || ''} />
                  </Row>
                ))}
              </Column>
            ) : null}

            {input.runes.length > 0 ? (
              <Column fullX gap="sm" mt="md">
                <Text text={`${t('runes')}:`} preset="sub" />
                {input.runes.map((rune) => (
                  <Row key={rune.runeid} justifyBetween fullX px="md" py="xl" style={riskAssetCardStyle}>
                    <Row>
                      <Text text={rune.spacedRune || rune.rune} />
                      {rune.symbol ? <Text text={` (${rune.symbol})`} /> : null}
                    </Row>
                    <Text text={new BigNumber(rune.amount).div(10 ** rune.divisibility).toString()} />
                  </Row>
                ))}
              </Column>
            ) : null}

            {input.alkanes.length > 0 ? (
              <Column fullX gap="sm" mt="md">
                <Text text={`${t('alkanes')}:`} preset="sub" />
                {input.alkanes.map((alkane) => (
                  <Row key={alkane.alkaneid} justifyBetween fullX px="md" py="xl" style={riskAssetCardStyle}>
                    <Row>
                      <Text text={alkane.name || alkane.symbol} />
                      {alkane.symbol && alkane.name !== alkane.symbol ? <Text text={` (${alkane.symbol})`} /> : null}
                    </Row>
                    <Text text={new BigNumber(alkane.amount).div(10 ** alkane.divisibility).toString()} />
                  </Row>
                ))}
              </Column>
            ) : null}
          </Column>
        );
      })}
    </RiskDetailPopover>
  );
};

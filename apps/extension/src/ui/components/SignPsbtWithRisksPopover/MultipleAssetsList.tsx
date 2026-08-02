import BigNumber from 'bignumber.js';

import { DecodedPsbt, DecodedPsbtInput, Inscription, RiskType } from '@unisat/wallet-shared';
import { useAlkanesIconInfo, useBRC20IconInfo, useI18n, useRunesIconInfo } from '@unisat/wallet-state';

import AssetTag from '../AssetTag';
import { Card } from '../Card';
import { Column } from '../Column';
import InscriptionPreview from '../InscriptionPreview';
import { Row } from '../Row';
import { RunesTicker } from '../RunesTicker';
import { Text } from '../Text';
import { getTokenBalanceCardStyle } from '../TokenBalanceCardLayout';
import { TokenBalanceIcon } from '../TokenBalanceIcon';
import { RiskDetailPopover, riskAssetCardStyle } from './RiskDetailPopover';

function getInputAssetsCount(input: DecodedPsbtInput) {
  return input.inscriptions.length + input.runes.length + input.alkanes.length;
}

function getInscription(inscriptions: Record<string, Inscription>, inscription: Inscription) {
  return inscriptions[inscription.inscriptionId] || inscription;
}

function getBurnedInscriptions(decodedPsbt: DecodedPsbt) {
  const outputInscriptionIds = new Set(
    decodedPsbt.outputInfos.flatMap((output) => output.inscriptions.map((inscription) => inscription.inscriptionId))
  );
  const seen = new Set<string>();

  return decodedPsbt.inputInfos.flatMap((input) =>
    input.inscriptions
      .map((inscription) => getInscription(decodedPsbt.inscriptions, inscription))
      .filter((inscription) => {
        if (outputInscriptionIds.has(inscription.inscriptionId) || seen.has(inscription.inscriptionId)) {
          return false;
        }
        seen.add(inscription.inscriptionId);
        return true;
      })
  );
}

function getBurnedBalances<T extends { amount: string }>(
  inputBalances: T[],
  outputBalances: T[],
  getId: (balance: T) => string
) {
  const inputBalanceMap = new Map<string, T>();
  const outputBalanceMap = new Map<string, T>();

  for (const balance of inputBalances) {
    const id = getId(balance);
    const previous = inputBalanceMap.get(id);
    inputBalanceMap.set(
      id,
      previous ? { ...balance, amount: new BigNumber(previous.amount).plus(balance.amount).toString() } : balance
    );
  }
  for (const balance of outputBalances) {
    const id = getId(balance);
    const previous = outputBalanceMap.get(id);
    outputBalanceMap.set(
      id,
      previous ? { ...balance, amount: new BigNumber(previous.amount).plus(balance.amount).toString() } : balance
    );
  }

  return [...inputBalanceMap.entries()].flatMap(([id, inputBalance]) => {
    const outputAmount = outputBalanceMap.get(id)?.amount || '0';
    const burnedAmount = new BigNumber(inputBalance.amount).minus(outputAmount);
    return burnedAmount.gt(0) ? [{ ...inputBalance, amount: burnedAmount.toString() }] : [];
  });
}

const assetCarouselStyle = {
  padding: 4,
  scrollSnapType: 'x mandatory',
  WebkitOverflowScrolling: 'touch'
};

const assetCarouselCardStyle = {
  flex: '0 0 120px',
  minWidth: 120,
  minHeight: 66,
  height: 66,
  paddingTop: 15,
  paddingBottom: 5,
  position: 'relative',
  scrollSnapAlign: 'start'
};

const assetTagStyle = {
  position: 'absolute' as const,
  top: 6,
  left: 8
};

const inscriptionCarouselCardStyle = {
  flex: '0 0 80px',
  minWidth: 80,
  scrollSnapAlign: 'start'
};

function RuneAssetCard({ rune }: { rune: DecodedPsbtInput['runes'][number] }) {
  const iconInfo = useRunesIconInfo(rune.spacedRune || rune.rune);
  const amount = new BigNumber(rune.amount).div(10 ** rune.divisibility).toString();

  return (
    <Card style={{ ...getTokenBalanceCardStyle(), ...assetCarouselCardStyle }}>
      <div style={assetTagStyle}>
        <AssetTag type="Runes" small />
      </div>
      <Row fullX itemsCenter gap="sm" style={{ minWidth: 0 }}>
        <TokenBalanceIcon iconInfo={iconInfo} />
        <Column gap="xs" style={{ minWidth: 0, overflow: 'hidden' }}>
          <RunesTicker tick={rune.spacedRune || rune.rune} truncate />
          <Text text={`${amount} ${rune.symbol || ''}`.trim()} size="xs" ellipsis />
        </Column>
      </Row>
    </Card>
  );
}

function AlkaneAssetCard({ alkane }: { alkane: DecodedPsbtInput['alkanes'][number] }) {
  const name = alkane.name || alkane.symbol || alkane.alkaneid;
  const iconInfo = useAlkanesIconInfo(name, alkane.alkaneid);
  const amount = new BigNumber(alkane.amount).div(10 ** alkane.divisibility).toString();

  return (
    <Card style={{ ...getTokenBalanceCardStyle(), ...assetCarouselCardStyle }}>
      <div style={assetTagStyle}>
        <AssetTag type="Alkanes" small />
      </div>
      <Row fullX itemsCenter gap="sm" style={{ minWidth: 0 }}>
        <TokenBalanceIcon iconInfo={iconInfo} />
        <Column gap="xs" style={{ minWidth: 0, overflow: 'hidden' }}>
          <RunesTicker tick={name} truncate />
          <Text text={`${amount} ${alkane.symbol || ''}`.trim()} size="xs" ellipsis />
        </Column>
      </Row>
    </Card>
  );
}

function Brc20AssetCard({ ticker, amount }: { ticker: string; amount: string }) {
  const iconInfo = useBRC20IconInfo(ticker);

  return (
    <Card style={{ ...getTokenBalanceCardStyle(), ...assetCarouselCardStyle }}>
      <div style={assetTagStyle}>
        <AssetTag type="brc-20" small />
      </div>
      <Row fullX itemsCenter gap="sm" style={{ minWidth: 0 }}>
        <TokenBalanceIcon iconInfo={iconInfo} />
        <Column gap="xs" style={{ minWidth: 0, overflow: 'hidden' }}>
          <Text text={ticker} size="sm" ellipsis />
          <Text text={amount} size="xs" ellipsis />
        </Column>
      </Row>
    </Card>
  );
}

export const MultipleAssetsCarousel = ({ decodedPsbt }: { decodedPsbt: DecodedPsbt }) => {
  const mixedInputs = decodedPsbt.inputInfos.filter((input) => getInputAssetsCount(input) > 1);

  return (
    <Row fullX gap="xs" overflowX style={assetCarouselStyle}>
      {mixedInputs.flatMap((input) => {
        const inscriptions = input.inscriptions
          .map((inscription) => getInscription(decodedPsbt.inscriptions, inscription))
          .filter((inscription) => !inscription.brc20);
        const brc20Inscriptions = input.inscriptions
          .map((inscription) => getInscription(decodedPsbt.inscriptions, inscription))
          .filter((inscription) => inscription.brc20);
        const outpoint = `${input.txid}:${input.vout}`;

        return [
          ...inscriptions.map((inscription) => (
            <Row
              key={`inscription:${outpoint}:${inscription.inscriptionId}`}
              style={inscriptionCarouselCardStyle}
              itemsCenter>
              <InscriptionPreview data={inscription} preset="xs" infoBgColor="#292929" />
            </Row>
          )),
          ...brc20Inscriptions.map((inscription) => (
            <Brc20AssetCard
              key={`brc20:${outpoint}:${inscription.inscriptionId}`}
              ticker={inscription.brc20?.tick || ''}
              amount={inscription.brc20?.amt || ''}
            />
          )),
          ...input.runes.map((rune) => <RuneAssetCard key={`rune:${outpoint}:${rune.runeid}`} rune={rune} />),
          ...input.alkanes.map((alkane) => (
            <AlkaneAssetCard key={`alkane:${outpoint}:${alkane.alkaneid}`} alkane={alkane} />
          ))
        ];
      })}
    </Row>
  );
};

export const BurningAssetsCarousel = ({ decodedPsbt, riskType }: { decodedPsbt: DecodedPsbt; riskType: RiskType }) => {
  const burnedInscriptions = getBurnedInscriptions(decodedPsbt);
  const burnedRunes = getBurnedBalances(
    decodedPsbt.inputInfos.flatMap((input) => input.runes),
    decodedPsbt.outputInfos.flatMap((output) => output.runes),
    (rune) => rune.runeid
  );
  const burnedAlkanes = getBurnedBalances(
    decodedPsbt.inputInfos.flatMap((input) => input.alkanes),
    decodedPsbt.outputInfos.flatMap((output) => output.alkanes),
    (alkane) => alkane.alkaneid
  );

  return (
    <Row fullX gap="xs" overflowX style={assetCarouselStyle}>
      {riskType === RiskType.INSCRIPTION_BURNING
        ? burnedInscriptions.map((inscription) =>
            inscription.brc20 ? (
              <Brc20AssetCard
                key={`burned-brc20:${inscription.inscriptionId}`}
                ticker={inscription.brc20.tick || ''}
                amount={inscription.brc20.amt || ''}
              />
            ) : (
              <Row
                key={`burned-inscription:${inscription.inscriptionId}`}
                style={inscriptionCarouselCardStyle}
                itemsCenter>
                <InscriptionPreview data={inscription} preset="xs" infoBgColor="#292929" />
              </Row>
            )
          )
        : null}
      {riskType === RiskType.RUNES_BURNING
        ? burnedRunes.map((rune) => <RuneAssetCard key={`burned-rune:${rune.runeid}`} rune={rune} />)
        : null}
      {riskType === RiskType.ALKANES_BURNING
        ? burnedAlkanes.map((alkane) => <AlkaneAssetCard key={`burned-alkane:${alkane.alkaneid}`} alkane={alkane} />)
        : null}
    </Row>
  );
};

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

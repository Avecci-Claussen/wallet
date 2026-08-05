import BigNumber from 'bignumber.js';
import { useRef } from 'react';
import type { CSSProperties, MouseEvent, ReactNode } from 'react';

import { DecodedPsbt, DecodedPsbtInput, Inscription, RiskType } from '@unisat/wallet-shared';
import { useAlkanesIconInfo, useBRC20IconInfo, useI18n, useRunesIconInfo } from '@unisat/wallet-state';

import { Card } from '../Card';
import { Column } from '../Column';
import { Image } from '../Image';
import InscriptionPreview from '../InscriptionPreview';
import { Row } from '../Row';
import { RunesTicker } from '../RunesTicker';
import { Text } from '../Text';
import { getTokenBalanceCardStyle } from '../TokenBalanceCardLayout';
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

const assetCarouselStyle: CSSProperties = {
  display: 'flex',
  width: '100%',
  overflowX: 'auto',
  gap: 4,
  padding: '0 8px',
  WebkitOverflowScrolling: 'touch',
  cursor: 'grab',
  userSelect: 'none'
};

const assetCarouselCardStyle: CSSProperties = {
  flex: '0 0 120px',
  minWidth: 120,
  minHeight: 60,
  height: 60,
  padding: '18px 8px 4px',
  backgroundColor: 'rgba(255, 255, 255, 0.06)',
  borderRadius: 12,
  position: 'relative'
};

const assetDetailCardStyle: CSSProperties = {
  flex: '0 1 auto',
  minWidth: 0,
  minHeight: 60,
  height: 'auto',
  width: '100%',
  padding: '18px 12px 8px',
  backgroundColor: 'rgba(255, 255, 255, 0.06)',
  borderRadius: 12,
  position: 'relative'
};

const assetTagStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0
};

const inscriptionCarouselCardStyle: CSSProperties = {
  flex: '0 0 80px',
  minWidth: 80
};

function AssetCarousel({ children }: { children: ReactNode }) {
  const dragState = useRef<{ startX: number; scrollLeft: number } | null>(null);

  const onMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    dragState.current = {
      startX: event.clientX,
      scrollLeft: event.currentTarget.scrollLeft
    };
    event.currentTarget.style.cursor = 'grabbing';
    event.preventDefault();
  };

  const onMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (!dragState.current) {
      return;
    }

    event.currentTarget.scrollLeft = dragState.current.scrollLeft - (event.clientX - dragState.current.startX);
    event.preventDefault();
  };

  const stopDragging = (event: MouseEvent<HTMLDivElement>) => {
    dragState.current = null;
    event.currentTarget.style.cursor = 'grab';
  };

  return (
    <div
      style={assetCarouselStyle}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={stopDragging}
      onMouseLeave={stopDragging}
    >
      {children}
    </div>
  );
}

function AssetIcon({ iconInfo }: { iconInfo: { iconShortName?: string; iconUrl: string } }) {
  if (iconInfo.iconUrl) {
    return (
      <Image
        size={24}
        style={{ borderRadius: 12, flexShrink: 0 }}
        src={iconInfo.iconUrl}
        fallbackSrc="./images/icons/artifacts/unknown.png"
      />
    );
  }

  return (
    <Column
      itemsCenter
      justifyCenter
      style={{ width: 24, height: 24, borderRadius: 12, border: '1px solid rgba(244, 182, 44, 0.85)', flexShrink: 0 }}
    >
      <Text text={iconInfo.iconShortName || '?'} size="xs" color="gold" />
    </Column>
  );
}

const carouselTagStyles = {
  'brc-20': { backgroundColor: 'rgba(244, 182, 44, 0.1)', color: 'rgba(244, 182, 44, 0.65)' },
  Runes: { backgroundColor: 'rgba(243, 145, 100, 0.1)', color: 'rgba(243, 145, 100, 0.65)' },
  Alkanes: { backgroundColor: 'rgba(62, 125, 224, 0.1)', color: 'rgba(62, 125, 224, 0.65)' }
};

function CarouselAssetTag({ type }: { type: keyof typeof carouselTagStyles }) {
  return (
    <div
      style={{
        ...carouselTagStyles[type],
        height: 16,
        padding: '1px 6px',
        borderRadius: '0 0 8px 0',
        boxSizing: 'border-box',
        fontSize: 10,
        lineHeight: '14px'
      }}
    >
      {type}
    </div>
  );
}

function RuneAssetCard({ rune, fullWidth = false }: { rune: DecodedPsbtInput['runes'][number]; fullWidth?: boolean }) {
  const iconInfo = useRunesIconInfo(rune.spacedRune || rune.rune);
  const amount = new BigNumber(rune.amount).div(10 ** rune.divisibility).toString();

  return (
    <Card
      style={{ ...getTokenBalanceCardStyle(fullWidth), ...(fullWidth ? assetDetailCardStyle : assetCarouselCardStyle) }}
    >
      <div style={assetTagStyle}>
        <CarouselAssetTag type="Runes" />
      </div>
      <Row fullX itemsCenter gap="sm" style={{ minWidth: 0, overflow: 'hidden' }}>
        <AssetIcon iconInfo={iconInfo} />
        <Column gap="xs" style={{ minWidth: 0, overflow: 'hidden', flex: fullWidth ? 1 : undefined }}>
          <RunesTicker tick={rune.spacedRune || rune.rune} truncate />
          <Text text={`${amount} ${rune.symbol || ''}`.trim()} size="xs" ellipsis />
        </Column>
      </Row>
    </Card>
  );
}

function AlkaneAssetCard({
  alkane,
  fullWidth = false
}: {
  alkane: DecodedPsbtInput['alkanes'][number];
  fullWidth?: boolean;
}) {
  const name = alkane.name || alkane.symbol || alkane.alkaneid;
  const iconInfo = useAlkanesIconInfo(name, alkane.alkaneid);
  const amount = new BigNumber(alkane.amount).div(10 ** alkane.divisibility).toString();

  return (
    <Card
      style={{ ...getTokenBalanceCardStyle(fullWidth), ...(fullWidth ? assetDetailCardStyle : assetCarouselCardStyle) }}
    >
      <div style={assetTagStyle}>
        <CarouselAssetTag type="Alkanes" />
      </div>
      <Row fullX itemsCenter gap="sm" style={{ minWidth: 0, overflow: 'hidden' }}>
        <AssetIcon iconInfo={iconInfo} />
        <Column gap="xs" style={{ minWidth: 0, overflow: 'hidden', flex: fullWidth ? 1 : undefined }}>
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
        <CarouselAssetTag type="brc-20" />
      </div>
      <Row fullX itemsCenter gap="sm" style={{ minWidth: 0 }}>
        <AssetIcon iconInfo={iconInfo} />
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
    <AssetCarousel>
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
              itemsCenter
            >
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
    </AssetCarousel>
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
    <AssetCarousel>
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
                itemsCenter
              >
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
    </AssetCarousel>
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
                    mt="md"
                  >
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
                  <RuneAssetCard key={rune.runeid} rune={rune} fullWidth />
                ))}
              </Column>
            ) : null}

            {input.alkanes.length > 0 ? (
              <Column fullX gap="sm" mt="md">
                <Text text={`${t('alkanes')}:`} preset="sub" />
                {input.alkanes.map((alkane) => (
                  <AlkaneAssetCard key={alkane.alkaneid} alkane={alkane} fullWidth />
                ))}
              </Column>
            ) : null}
          </Column>
        );
      })}
    </RiskDetailPopover>
  );
};

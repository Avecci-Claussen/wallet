import { useEffect, useState } from 'react';

import { colors } from '@/ui/theme/colors';
import { DecodedPsbt, Risk, RiskType } from '@unisat/wallet-shared';
import { useI18n } from '@unisat/wallet-state';

import { Button } from '../Button';
import { Checkbox } from '../Checkbox';
import { Column } from '../Column';
import { Icon } from '../Icon';
import { Input } from '../Input';
import { Popover } from '../Popover';
import { Row } from '../Row';
import { Text } from '../Text';
import { BadFeeRate } from './BadFeeRate';
import { ChangingInscription } from './ChangingInscription';
import { InscriptionBurning } from './InscriptionBurning';
import { BurningAssetsCarousel, MultipleAssetsCarousel, MultipleAssetsList } from './MultipleAssetsList';
import { RunesBurningList } from './RunesBurningList';

const riskPopoverStyle = {
  width: 343,
  boxSizing: 'border-box' as const,
  padding: '24px 16px',
  borderRadius: 12,
  backgroundColor: '#181A1F'
};

const riskCardStyle = {
  border: '1px solid rgba(255, 255, 255, 0.15)',
  borderRadius: 8,
  overflow: 'hidden'
};

const riskCardHeaderStyle = {
  minHeight: 36,
  padding: '0 8px'
};

function IndexingRiskDescription({ text }: { text: string }) {
  const duration = 'about 5 minutes.';
  const durationIndex = text.indexOf(duration);
  const descriptionStyle = {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 12,
    lineHeight: '16px',
    padding: '0 8px 8px'
  };

  if (durationIndex === -1) {
    return <div style={descriptionStyle}>{text}</div>;
  }

  return (
    <div style={descriptionStyle}>
      {text.slice(0, durationIndex)}
      <span style={{ color: 'rgba(244, 182, 44, 0.85)' }}>{duration}</span>
      {text.slice(durationIndex + duration.length)}
    </div>
  );
}

const visibleRiskDetailTypes = [
  RiskType.MULTIPLE_ASSETS,
  RiskType.RUNES_MULTIPLE_ASSETS,
  RiskType.ALKANES_MULTIPLE_ASSETS,
  RiskType.INSCRIPTION_BURNING,
  RiskType.ATOMICALS_FT_BURNING,
  RiskType.ATOMICALS_NFT_BURNING,
  RiskType.LOW_FEE_RATE,
  RiskType.HIGH_FEE_RATE,
  //   RiskType.SPLITTING_INSCRIPTIONS,
  //   RiskType.MERGING_INSCRIPTIONS,
  RiskType.CHANGING_INSCRIPTION,
  RiskType.RUNES_BURNING
];

function getRiskContentKey(riskType: RiskType) {
  switch (riskType) {
    case RiskType.SIGHASH_NONE:
      return {
        title: 'sighash_none_risk_title',
        description: 'sighash_none_risk_description'
      };
    case RiskType.SCAMMER_ADDRESS:
      return {
        title: 'scammer_address_risk_title',
        description: 'scammer_address_risk_description'
      };
    case RiskType.NETWORK_NOT_MATCHED:
      return {
        title: 'network_not_matched_risk_title',
        description: 'network_not_matched_risk_description'
      };
    case RiskType.INSCRIPTION_BURNING:
      return {
        title: 'inscription_burning_risk_title',
        description: 'inscription_burning_risk_description'
      };
    case RiskType.MULTIPLE_ASSETS:
      return {
        title: 'multiple_assets_risk_title',
        description: 'multiple_assets_risk_description'
      };
    case RiskType.HIGH_FEE_RATE:
      return {
        title: 'high_fee_rate_risk_title',
        description: 'high_fee_rate_risk_description'
      };
    case RiskType.MERGING_INSCRIPTIONS:
      return {
        title: 'merging_inscriptions_risk_title',
        description: 'merging_inscriptions_risk_description'
      };
    case RiskType.CHANGING_INSCRIPTION:
      return {
        title: 'changing_inscription_risk_title',
        description: 'changing_inscription_risk_description'
      };
    case RiskType.RUNES_BURNING:
      return {
        title: 'runes_burning_risk_title',
        description: 'runes_burning_risk_description'
      };
    case RiskType.RUNES_MULTIPLE_ASSETS:
      return {
        title: 'runes_multiple_assets_risk_title',
        description: 'runes_multiple_assets_risk_description'
      };
    case RiskType.INDEXER_API_DOWN:
      return {
        title: 'indexer_api_down_risk_title',
        description: 'indexer_api_down_risk_description'
      };
    case RiskType.RUNES_API_DOWN:
      return {
        title: 'runes_api_down_risk_title',
        description: 'runes_api_down_risk_description'
      };
    case RiskType.ALKANES_BURNING:
      return {
        title: 'alkanes_burning_risk_title',
        description: 'alkanes_burning_risk_description'
      };
    case RiskType.ALKANES_MULTIPLE_ASSETS:
      return {
        title: 'alkanes_multiple_assets_risk_title',
        description: 'alkanes_multiple_assets_risk_description'
      };
    case RiskType.UTXO_INDEXING:
      return {
        title: 'utxo_indexing_risk_title',
        description: 'utxo_indexing_risk_description'
      };
    default:
      return {
        title: 'unknown_risk_title',
        description: 'unknown_risk_description'
      };
  }
}

export const SignPsbtWithRisksPopover = ({
  decodedPsbt,
  onConfirm,
  onClose
}: {
  decodedPsbt: DecodedPsbt;
  onConfirm: () => void;
  onClose: () => void;
}) => {
  const [inputValue, setInputValue] = useState('');
  const [understand, setUnderstand] = useState(false);
  const [indexingRiskAccepted, setIndexingRiskAccepted] = useState(false);
  const { t } = useI18n();
  const AGREEMENT_TEXT = 'CONFIRM';
  const hasUtxoIndexingRisk = decodedPsbt.risks.some((risk) => risk.type === RiskType.UTXO_INDEXING);
  const otherRisks = decodedPsbt.risks.filter((risk) => risk.type !== RiskType.UTXO_INDEXING);

  useEffect(() => {
    if (inputValue.toUpperCase() === AGREEMENT_TEXT) {
      setUnderstand(true);
    } else {
      setUnderstand(false);
    }
  }, [inputValue]);

  const [detailRisk, setDetailRisk] = useState<Risk | null>();

  const confirmable = !otherRisks.some((risk) => risk.level === 'critical');

  if (detailRisk) {
    if (detailRisk.type === RiskType.INSCRIPTION_BURNING) {
      return <InscriptionBurning decodedPsbt={decodedPsbt} onClose={() => setDetailRisk(null)} />;
    } else if (
      detailRisk.type === RiskType.MULTIPLE_ASSETS ||
      detailRisk.type === RiskType.RUNES_MULTIPLE_ASSETS ||
      detailRisk.type === RiskType.ALKANES_MULTIPLE_ASSETS
    ) {
      return <MultipleAssetsList decodedPsbt={decodedPsbt} onClose={() => setDetailRisk(null)} />;
    } else if (detailRisk.type === RiskType.LOW_FEE_RATE || detailRisk.type === RiskType.HIGH_FEE_RATE) {
      const riskContentKey = getRiskContentKey(detailRisk.type);
      return (
        <BadFeeRate decodedPsbt={decodedPsbt} riskContentKey={riskContentKey} onClose={() => setDetailRisk(null)} />
      );
    } else if (detailRisk.type === RiskType.CHANGING_INSCRIPTION) {
      return <ChangingInscription decodedPsbt={decodedPsbt} onClose={() => setDetailRisk(null)} />;
    } else if (detailRisk.type === RiskType.RUNES_BURNING) {
      return <RunesBurningList decodedPsbt={decodedPsbt} onClose={() => setDetailRisk(null)} />;
    }
  }

  if (hasUtxoIndexingRisk) {
    const hasCriticalRisk = otherRisks.some((risk) => risk.level === 'critical');

    return (
      <Popover
        onClose={onClose}
        contentStyle={riskPopoverStyle}
        closeStyle={{ top: 24, right: 16 }}
        data-testid="utxo-indexing-risk-popover"
      >
        <Column fullX gap="xl">
          <Column fullX gap="lg">
            <Text text={t('utxo_indexing_risk_title')} size="md" style={{ fontWeight: 600 }} textCenter />
            <Text
              text={t('multiple_risks_detected_description')}
              preset="sub"
              style={{ color: 'rgba(255, 255, 255, 0.65)', lineHeight: '16px' }}
            />
          </Column>

          <Column fullX gap="lg">
            {otherRisks.map((risk, index) => {
              const riskContentKey = getRiskContentKey(risk.type);
              const title = riskContentKey.title ? t(riskContentKey.title) : risk.title;
              const desc = riskContentKey.description ? t(riskContentKey.description) : risk.desc;
              const isMultipleAssetsRisk = [
                RiskType.MULTIPLE_ASSETS,
                RiskType.RUNES_MULTIPLE_ASSETS,
                RiskType.ALKANES_MULTIPLE_ASSETS
              ].includes(risk.type);
              const isBurningRisk =
                risk.type === RiskType.INSCRIPTION_BURNING ||
                risk.type === RiskType.RUNES_BURNING ||
                risk.type === RiskType.ALKANES_BURNING;

              return (
                <Column key={'risk_' + index} fullX gap="zero" style={riskCardStyle}>
                  <Row fullX justifyBetween itemsCenter style={riskCardHeaderStyle}>
                    <Row itemsCenter gap="md" style={{ minWidth: 0 }}>
                      <Icon icon="alert" color="red_light2" size={16} />
                      <Text text={title} size="xs" color={risk.level === 'warning' ? 'warning' : 'danger'} />
                    </Row>
                    {visibleRiskDetailTypes.includes(risk.type) ? (
                      <Row
                        itemsCenter
                        gap="md"
                        onClick={() => {
                          setDetailRisk(risk);
                        }}
                      >
                        <Text text={t('view')} preset="sub" style={{ color: 'rgba(255, 255, 255, 0.65)' }} />
                        <Icon icon="right" size={10} color="white_muted" />
                      </Row>
                    ) : null}
                  </Row>
                  <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.15)' }} />
                  {isMultipleAssetsRisk ? (
                    <MultipleAssetsCarousel decodedPsbt={decodedPsbt} />
                  ) : isBurningRisk ? (
                    <BurningAssetsCarousel decodedPsbt={decodedPsbt} riskType={risk.type} />
                  ) : (
                    <Text
                      text={desc}
                      preset="sub"
                      style={{ color: 'rgba(255, 255, 255, 0.65)', lineHeight: '16px', padding: '8px' }}
                    />
                  )}
                </Column>
              );
            })}

            <Column fullX gap="md" style={riskCardStyle}>
              <Row fullX itemsCenter gap="md" style={riskCardHeaderStyle}>
                <div
                  aria-hidden
                  style={{
                    width: 16,
                    height: 16,
                    border: '2px solid #F55454',
                    borderBottomColor: 'transparent',
                    borderRadius: '50%',
                    boxSizing: 'border-box'
                  }}
                />
                <Text text={t('utxo_indexing_in_progress')} size="xs" color="danger" />
              </Row>
              <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.15)' }} />
              <IndexingRiskDescription text={t('utxo_indexing_risk_description')} />
            </Column>
          </Column>

          {!hasCriticalRisk && (
            <Checkbox
              checked={indexingRiskAccepted}
              checkedColor={colors.red}
              checkColor={colors.white}
              style={{ alignSelf: 'stretch', alignItems: 'flex-start' }}
              data-testid="utxo-indexing-risk-checkbox"
              onChange={(e) => setIndexingRiskAccepted(e.target.checked)}
            >
              <Text
                text={t('utxo_indexing_risk_agreement')}
                preset="sub"
                style={{ color: 'rgba(255, 255, 255, 0.65)', lineHeight: '16px', flex: 1 }}
              />
            </Checkbox>
          )}

          <Column fullX gap="md">
            {!hasCriticalRisk && (
              <Button
                text={t('understand_the_risks_continue')}
                preset="delete"
                disabled={!indexingRiskAccepted}
                full
                onClick={() => {
                  onConfirm();
                }}
              />
            )}
            <Button text={t('try_again_later')} preset="primary" full onClick={onClose} />
          </Column>
        </Column>
      </Popover>
    );
  }

  return (
    <Popover onClose={onClose}>
      <Column justifyCenter itemsCenter>
        <Icon icon={'alert'} color={'red'} size={20} />
        <Text text={t('use_at_your_own_risk')} preset="title-bold" />
        <Text text={t('please_be_aware_that_sending_the_following_assets_involves_risk')} preset="sub" />

        <Column gap="md" fullX mb="md">
          {otherRisks.map((risk, index) => {
            const riskContentKey = getRiskContentKey(risk.type);
            const title = riskContentKey.title ? t(riskContentKey.title) : risk.title;
            const desc = riskContentKey.description ? t(riskContentKey.description) : risk.desc;
            const isMultipleAssetsRisk = risk.type === RiskType.MULTIPLE_ASSETS;
            const isBurningRisk =
              risk.type === RiskType.INSCRIPTION_BURNING ||
              risk.type === RiskType.RUNES_BURNING ||
              risk.type === RiskType.ALKANES_BURNING;
            return (
              <Column
                key={'risk_' + index}
                style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10 }}
                px="md"
                py="sm"
              >
                <Row justifyBetween justifyCenter mt="sm">
                  <Text text={title} color={risk.level === 'warning' ? 'warning' : 'danger'} />
                  {visibleRiskDetailTypes.includes(risk.type) ? (
                    <Text
                      text={t('view')}
                      onClick={() => {
                        setDetailRisk(risk);
                      }}
                    />
                  ) : null}
                </Row>
                <Row style={{ borderBottomWidth: 1, color: colors.border }}></Row>
                {isMultipleAssetsRisk ? (
                  <MultipleAssetsCarousel decodedPsbt={decodedPsbt} />
                ) : isBurningRisk ? (
                  <BurningAssetsCarousel decodedPsbt={decodedPsbt} riskType={risk.type} />
                ) : (
                  <Text text={desc} preset="sub" />
                )}
              </Column>
            );
          })}

          {confirmable && (
            <Column>
              <Text text={t('understand_and_accept_the_risks_associated_with_this_transaction')} preset="sub" />

              <Row itemsCenter gap="sm" mb="md">
                <Text text={`${t('enter')} “${AGREEMENT_TEXT}” ${t('to_proceed')}`} preset="bold" />
              </Row>
              <Input
                preset="text"
                autoFocus={true}
                onChange={(e) => {
                  setInputValue(e.target.value);
                }}
              />
            </Column>
          )}
        </Column>

        <Row full>
          <Button
            text={t('cancel')}
            preset="default"
            full
            onClick={(_e) => {
              if (onClose) {
                onClose();
              }
            }}
          />

          {confirmable && (
            <Button
              text={t('confirm')}
              preset="danger"
              disabled={!understand}
              full
              onClick={(_e) => {
                if (onConfirm) {
                  onConfirm();
                }
              }}
            />
          )}
        </Row>
      </Column>
    </Popover>
  );
};
